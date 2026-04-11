import type { Project, CiCdConfig, CiPlatform } from '../types'

// ── helpers ──────────────────────────────────────────────────────────────────

function installCmd(pm: CiCdConfig['packageManager']): string {
  return pm === 'npm' ? 'npm ci'
    : pm === 'yarn' ? 'yarn install --frozen-lockfile'
    : 'pnpm install --frozen-lockfile'
}

function runCmd(pm: CiCdConfig['packageManager'], extra = ''): string {
  const base = pm === 'npm' ? 'npx playwright test'
    : pm === 'yarn' ? 'yarn playwright test'
    : 'pnpm playwright test'
  return extra ? `${base} ${extra}` : base
}

function lockFile(pm: CiCdConfig['packageManager']): string {
  return pm === 'npm' ? 'package-lock.json'
    : pm === 'yarn' ? 'yarn.lock'
    : 'pnpm-lock.yaml'
}

function cacheConfig(pm: CiCdConfig['packageManager']): { cache: string; path: string } {
  return pm === 'npm'
    ? { cache: 'npm', path: '~/.npm' }
    : pm === 'yarn'
    ? { cache: 'yarn', path: '~/.yarn/cache' }
    : { cache: 'pnpm', path: '~/.local/share/pnpm/store' }
}

// ── GitHub Actions ────────────────────────────────────────────────────────────

function generateGitHub(project: Project, cfg: CiCdConfig): string {
  const { packageManager: pm, nodeVersion, shardEnabled, shardWorkers,
    pushBranches, pullRequests, manualTrigger, scheduledCron } = cfg
  const { cache } = cacheConfig(pm)
  const lf = lockFile(pm)
  const hasSensitiveVars = false // could inspect project.variables in future
  const hasEnvs = (project.environments ?? []).filter(e => e.baseUrl).length > 0
  const hasAuth = project.auth?.enabled && (project.auth.roles.length > 0)
  const traceOnFailure = true // always include trace upload

  const onBlock = buildOnBlock(pushBranches, pullRequests, manualTrigger, scheduledCron)

  const setupSteps = `
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js ${nodeVersion}
        uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
          cache: '${cache}'
${pm === 'pnpm' ? `\n      - name: Setup pnpm\n        uses: pnpm/action-setup@v4\n` : ''}
      - name: Install dependencies
        run: ${installCmd(pm)}

      - name: Cache Playwright browsers
        id: pw-cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-\${{ hashFiles('${lf}') }}-\${{ runner.os }}

      - name: Install Playwright browsers
        run: npx playwright install --with-deps
`.trim()

  // ── No sharding, single job ──────────────────────────────────────────────

  if (!shardEnabled) {
    const jobsBlock = hasEnvs
      ? buildGitHubEnvJobs(project, cfg, setupSteps)
      : `  test:
    name: Playwright Tests
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - ${setupSteps.split('\n      - ').join('\n      - ')}

      - name: Run Playwright tests
        run: ${runCmd(pm)}
        env:
          CI: 'true'
${hasAuth ? `          STORAGE_STATE_DIR: storage-states\n` : ''}
      - name: Upload HTML report
        uses: actions/upload-artifact@v4
        if: \${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

      - name: Upload test traces
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-traces
          path: test-results/
          retention-days: 7`

    return `name: Playwright Tests
${onBlock}
jobs:
${jobsBlock}
`
  }

  // ── Sharding ─────────────────────────────────────────────────────────────

  const indices = Array.from({ length: shardWorkers }, (_, i) => i + 1)

  return `name: Playwright Tests
${onBlock}
jobs:
  test:
    name: "Tests (shard \${{ matrix.shardIndex }}/${shardWorkers})"
    runs-on: ubuntu-latest
    timeout-minutes: 60
    strategy:
      fail-fast: false
      matrix:
        shardIndex: [${indices.join(', ')}]
        shardTotal: [${shardWorkers}]

    steps:
      - ${setupSteps.split('\n      - ').join('\n      - ')}

      - name: Run Playwright tests
        run: ${runCmd(pm, '--reporter=blob --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}')}
        env:
          CI: 'true'

      - name: Upload blob report
        uses: actions/upload-artifact@v4
        if: \${{ !cancelled() }}
        with:
          name: blob-report-\${{ matrix.shardIndex }}
          path: blob-report/
          retention-days: 1

  merge-reports:
    name: Merge Reports
    needs: test
    runs-on: ubuntu-latest
    if: \${{ !cancelled() }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
          cache: '${cache}'

      - run: ${installCmd(pm)}

      - name: Download all blob reports
        uses: actions/download-artifact@v4
        with:
          path: all-blob-reports
          pattern: blob-report-*
          merge-multiple: true

      - name: Merge reports
        run: npx playwright merge-reports --reporter html ./all-blob-reports

      - name: Upload HTML report
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report--attempt-\${{ github.run_attempt }}
          path: playwright-report/
          retention-days: 30
`
}

function buildGitHubEnvJobs(project: Project, cfg: CiCdConfig, setupSteps: string): string {
  const { packageManager: pm } = cfg
  const envs = (project.environments ?? []).filter(e => e.baseUrl)
  return envs.map(env => `  test-${slugify(env.name)}:
    name: "Tests (${env.name})"
    runs-on: ubuntu-latest
    timeout-minutes: 60
    environment: ${env.name}
    steps:
      - ${setupSteps.split('\n      - ').join('\n      - ')}

      - name: Run Playwright tests
        run: ${runCmd(pm)}
        env:
          BASE_URL: '${env.baseUrl}'
          CI: 'true'

      - name: Upload HTML report
        uses: actions/upload-artifact@v4
        if: \${{ !cancelled() }}
        with:
          name: playwright-report-${slugify(env.name)}
          path: playwright-report/
          retention-days: 30

      - name: Upload traces
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: traces-${slugify(env.name)}
          path: test-results/
          retention-days: 7`).join('\n\n')
}

function buildOnBlock(branches: string[], pr: boolean, manual: boolean, cron: string): string {
  const parts: string[] = []
  if (branches.length > 0) {
    parts.push(`  push:\n    branches: [${branches.map(b => `'${b}'`).join(', ')}]`)
  }
  if (pr) parts.push(`  pull_request:`)
  if (manual) parts.push(`  workflow_dispatch:`)
  if (cron.trim()) parts.push(`  schedule:\n    - cron: '${cron.trim()}'`)
  return `on:\n${parts.join('\n')}\n`
}

// ── GitLab CI ─────────────────────────────────────────────────────────────────

function generateGitLab(project: Project, cfg: CiCdConfig): string {
  const { packageManager: pm, nodeVersion, shardEnabled, shardWorkers,
    pushBranches, pullRequests, scheduledCron } = cfg
  const lf = lockFile(pm)
  const hasEnvs = (project.environments ?? []).filter(e => e.baseUrl).length > 0

  const rulesBlock = buildGitLabRules(pushBranches, pullRequests, scheduledCron)

  const cacheBlock = `cache:
  key:
    files:
      - ${lf}
  paths:
    - node_modules/
    - .cache/ms-playwright/`

  const baseScript = [
    installCmd(pm),
    'npx playwright install --with-deps',
  ]

  if (!shardEnabled && !hasEnvs) {
    return `image: mcr.microsoft.com/playwright:v1.48.0-focal

stages:
  - test

${cacheBlock}

playwright:
  stage: test
  script:
    - ${baseScript.join('\n    - ')}
    - ${runCmd(pm)}
  artifacts:
    when: always
    expire_in: 1 week
    paths:
      - playwright-report/
      - test-results/
${project.reporter === 'junit' ? `    reports:\n      junit: test-results/junit.xml\n` : ''}\
${rulesBlock ? `  rules:\n${rulesBlock}` : ''}
`
  }

  if (shardEnabled) {
    return `image: mcr.microsoft.com/playwright:v1.48.0-focal

stages:
  - test
  - merge

${cacheBlock}

playwright:
  stage: test
  parallel: ${shardWorkers}
  script:
    - ${baseScript.join('\n    - ')}
    - ${runCmd(pm, '--reporter=blob --shard=$CI_NODE_INDEX/$CI_NODE_TOTAL')}
  artifacts:
    when: always
    expire_in: 1 day
    paths:
      - blob-report/
${rulesBlock ? `  rules:\n${rulesBlock}` : ''}

merge-reports:
  stage: merge
  needs: [playwright]
  when: always
  script:
    - npm ci
    - npx playwright merge-reports --reporter html ./blob-report
  artifacts:
    when: always
    expire_in: 1 week
    paths:
      - playwright-report/
`
  }

  // Per-environment jobs
  const envs = (project.environments ?? []).filter(e => e.baseUrl)
  const envJobs = envs.map(env => `playwright-${slugify(env.name)}:
  stage: test
  variables:
    BASE_URL: '${env.baseUrl}'
  script:
    - ${baseScript.join('\n    - ')}
    - ${runCmd(pm)}
  artifacts:
    when: always
    expire_in: 1 week
    paths:
      - playwright-report/
      - test-results/
`).join('\n')

  return `image: mcr.microsoft.com/playwright:v1.48.0-focal

stages:
  - test

${cacheBlock}

${envJobs}
`
}

function buildGitLabRules(branches: string[], pr: boolean, cron: string): string {
  const rules: string[] = []
  if (branches.length > 0) {
    branches.forEach(b => rules.push(`    - if: '$CI_COMMIT_BRANCH == "${b}"'`))
  }
  if (pr) rules.push(`    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'`)
  if (cron.trim()) rules.push(`    - if: '$CI_PIPELINE_SOURCE == "schedule"'`)
  return rules.join('\n')
}

// ── Azure DevOps ──────────────────────────────────────────────────────────────

function generateAzure(project: Project, cfg: CiCdConfig): string {
  const { packageManager: pm, nodeVersion, shardEnabled, shardWorkers,
    pushBranches, pullRequests, scheduledCron } = cfg

  const triggerBlock = pushBranches.length > 0
    ? `trigger:\n  branches:\n    include:\n${pushBranches.map(b => `      - ${b}`).join('\n')}`
    : `trigger: none`

  const prBlock = pullRequests
    ? `\npr:\n  branches:\n    include:\n${pushBranches.map(b => `      - ${b}`).join('\n')}`
    : ''

  const scheduleBlock = scheduledCron.trim()
    ? `\nschedules:\n  - cron: '${scheduledCron.trim()}'\n    displayName: Scheduled run\n    branches:\n      include:\n        - main\n    always: true`
    : ''

  const installSteps = `          - task: NodeTool@0
            inputs:
              versionSpec: '${nodeVersion}'
            displayName: 'Install Node.js'
${pm === 'pnpm' ? `\n          - script: npm install -g pnpm\n            displayName: 'Install pnpm'\n` : ''}
          - task: Cache@2
            inputs:
              key: '"playwright" | "\$(Agent.OS)" | ${lockFile(pm)}'
              path: ~/.cache/ms-playwright
            displayName: 'Cache Playwright browsers'

          - script: ${installCmd(pm)}
            displayName: 'Install dependencies'

          - script: npx playwright install --with-deps
            displayName: 'Install Playwright browsers'`

  const artifactSteps = `\n          - task: PublishPipelineArtifact@1
            condition: always()
            inputs:
              artifactName: playwright-report
              targetPath: playwright-report
            displayName: 'Upload HTML report'

          - task: PublishPipelineArtifact@1
            condition: failed()
            inputs:
              artifactName: test-traces
              targetPath: test-results
            displayName: 'Upload traces on failure'
${project.reporter === 'junit' ? `\n          - task: PublishTestResults@2\n            condition: always()\n            inputs:\n              testResultsFormat: JUnit\n              testResultsFiles: '**/test-results/*.xml'\n            displayName: 'Publish test results'\n` : ''}`

  if (!shardEnabled) {
    return `${triggerBlock}${prBlock}${scheduleBlock}

pool:
  vmImage: ubuntu-latest

variables:
  CI: 'true'

stages:
  - stage: Test
    displayName: Playwright Tests
    jobs:
      - job: Test
        timeoutInMinutes: 60
        steps:
${installSteps}

          - script: ${runCmd(pm)}
            displayName: 'Run Playwright tests'
            env:
              CI: 'true'
${artifactSteps}
`
  }

  return `${triggerBlock}${prBlock}${scheduleBlock}

pool:
  vmImage: ubuntu-latest

stages:
  - stage: Test
    displayName: Playwright Tests
    jobs:
${Array.from({ length: shardWorkers }, (_, i) => i + 1).map(i => `      - job: Test_Shard_${i}
        displayName: "Tests (Shard ${i}/${shardWorkers})"
        timeoutInMinutes: 60
        steps:
${installSteps}

          - script: ${runCmd(pm, `--reporter=blob --shard=${i}/${shardWorkers}`)}
            displayName: 'Run Playwright tests (shard ${i}/${shardWorkers})'
            env:
              CI: 'true'

          - task: PublishPipelineArtifact@1
            condition: always()
            inputs:
              artifactName: blob-report-${i}
              targetPath: blob-report
            displayName: 'Upload blob report'`).join('\n\n')}

  - stage: MergeReports
    displayName: Merge Reports
    dependsOn: Test
    condition: always()
    jobs:
      - job: Merge
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '${nodeVersion}'

          - script: ${installCmd(pm)}

          - task: DownloadPipelineArtifact@2
            inputs:
              patterns: 'blob-report-*/**'
              path: all-blob-reports

          - script: npx playwright merge-reports --reporter html ./all-blob-reports
            displayName: 'Merge reports'

          - task: PublishPipelineArtifact@1
            inputs:
              artifactName: playwright-report
              targetPath: playwright-report
            displayName: 'Upload merged HTML report'
`
}

// ── Jenkins ───────────────────────────────────────────────────────────────────

function generateJenkins(project: Project, cfg: CiCdConfig): string {
  const { packageManager: pm, nodeVersion, shardEnabled, shardWorkers, scheduledCron } = cfg
  const hasEnvs = (project.environments ?? []).filter(e => e.baseUrl).length > 0

  const cronTrigger = scheduledCron.trim()
    ? `    triggers {\n        cron('${scheduledCron.trim()}')\n    }\n    `
    : ''

  if (shardEnabled) {
    const shardMap: string[] = []
    for (let i = 1; i <= shardWorkers; i++) {
      shardMap.push(`                "shard-${i}": {
                    stage("Shard ${i}/${shardWorkers}") {
                        sh '${runCmd(pm, `--reporter=blob --shard=${i}/${shardWorkers}`)}'
                    }
                }`)
    }

    return `pipeline {
    agent {
        docker {
            image 'mcr.microsoft.com/playwright:v1.48.0-focal'
            args '-u root'
        }
    }

    ${cronTrigger}options {
        timeout(time: 60, unit: 'MINUTES')
    }

    environment {
        CI = 'true'
        HOME = '.'
    }

    stages {
        stage('Install') {
            steps {
                sh 'node --version'
                sh '${installCmd(pm)}'
                sh 'npx playwright install --with-deps'
            }
        }

        stage('Test') {
            steps {
                script {
                    parallel(
${shardMap.join(',\n')}
                    )
                }
            }
        }

        stage('Merge Reports') {
            steps {
                sh 'npx playwright merge-reports --reporter html ./blob-report'
            }
        }
    }

    post {
        always {
            publishHTML(target: [
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'playwright-report',
                reportFiles: 'index.html',
                reportName: 'Playwright Report'
            ])
        }
        failure {
            archiveArtifacts(
                artifacts: 'test-results/**',
                allowEmptyArchive: true
            )
        }
    }
}
`
  }

  if (hasEnvs) {
    const envs = (project.environments ?? []).filter(e => e.baseUrl)
    const envStages = envs.map(env => `        stage('Test — ${env.name}') {
            environment {
                BASE_URL = '${env.baseUrl}'
            }
            steps {
                sh '${runCmd(pm)}'
            }
        }`).join('\n\n')

    return `pipeline {
    agent {
        docker {
            image 'mcr.microsoft.com/playwright:v1.48.0-focal'
            args '-u root'
        }
    }

    ${cronTrigger}options {
        timeout(time: 60, unit: 'MINUTES')
    }

    environment {
        CI = 'true'
        HOME = '.'
    }

    stages {
        stage('Install') {
            steps {
                sh '${installCmd(pm)}'
                sh 'npx playwright install --with-deps'
            }
        }

${envStages}
    }

    post {
        always {
            publishHTML(target: [
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'playwright-report',
                reportFiles: 'index.html',
                reportName: 'Playwright Report'
            ])
        }
        failure {
            archiveArtifacts(artifacts: 'test-results/**', allowEmptyArchive: true)
        }
    }
}
`
  }

  return `pipeline {
    agent {
        docker {
            image 'mcr.microsoft.com/playwright:v1.48.0-focal'
            args '-u root'
        }
    }

    ${cronTrigger}options {
        timeout(time: 60, unit: 'MINUTES')
    }

    environment {
        CI = 'true'
        HOME = '.'
    }

    stages {
        stage('Install') {
            steps {
                sh '${installCmd(pm)}'
                sh 'npx playwright install --with-deps'
            }
        }

        stage('Test') {
            steps {
                sh '${runCmd(pm)}'
            }
        }
    }

    post {
        always {
            publishHTML(target: [
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'playwright-report',
                reportFiles: 'index.html',
                reportName: 'Playwright Report'
            ])
        }
        failure {
            archiveArtifacts(
                artifacts: 'test-results/**',
                allowEmptyArchive: true
            )
        }
    }
}
`
}

// ── public API ────────────────────────────────────────────────────────────────

export function generateCiConfig(project: Project, cfg: CiCdConfig, platform: CiPlatform): string {
  switch (platform) {
    case 'github': return generateGitHub(project, cfg)
    case 'gitlab': return generateGitLab(project, cfg)
    case 'azure':  return generateAzure(project, cfg)
    case 'jenkins': return generateJenkins(project, cfg)
  }
}

export function generateAllCiConfigs(
  project: Project,
  cfg: CiCdConfig
): Record<CiPlatform, string> {
  const result = {} as Record<CiPlatform, string>
  for (const platform of cfg.platforms) {
    result[platform] = generateCiConfig(project, cfg, platform)
  }
  return result
}

// ── utility ───────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}
