import JSZip from 'jszip'
import type { Project, Feature, TestCase, GlobalVariable, ReusableUtil, Fixture } from '../types'
import { CI_PLATFORM_META } from '../types'
import {
  generateConfig,
  generateGlobalSetup,
  generateConstants,
  generateEnvFile,
  generateUtilHelper,
  generateFixtureFile,
  generatePOM,
  generateSpecFile,
  generateRunOrderScript,
} from './codeGenerator'
import { generateCiConfig } from './ciConfigGenerator'
import { getSameFeatureSerialGroups } from './depGraph'

interface GenerateInput {
  project: Project
  features: Feature[]
  testCases: TestCase[]
  variables: GlobalVariable[]
  utils: ReusableUtil[]
  fixtures: Fixture[]
}

function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export async function generateAndDownload(input: GenerateInput): Promise<void> {
  const { project, features, testCases: input_testCases, variables, utils, fixtures } = input
  // Exclude disabled TCs from all generated output
  const testCases = input_testCases.filter((tc) => !tc.disabled)
  const ext = project.language === 'typescript' ? 'ts' : 'js'
  const zip = new JSZip()
  const root = zip.folder(slug(project.name))!

  // playwright.config
  root.file(`playwright.config.${ext}`, generateConfig(project))

  // global-setup (auth)
  if (project.auth?.enabled) {
    root.file(`global-setup.${ext}`, generateGlobalSetup(project))
  }

  // .env.test
  root.file('.env.test', generateEnvFile(variables))

  // utils/constants
  const utilsFolder = root.folder('utils')!
  utilsFolder.file(`constants.${ext}`, generateConstants(variables, project.language))

  // util helpers
  for (const util of utils) {
    utilsFolder.file(
      `${util.name}.helper.${ext}`,
      generateUtilHelper(util, variables, project.language)
    )
  }

  // fixtures
  if (fixtures.length > 0) {
    const fixturesFolder = root.folder('fixtures')!
    for (const fx of fixtures) {
      fixturesFolder.file(`${slug(fx.name)}.json`, generateFixtureFile(fx))
    }
  }

  // pages (POM)
  if (project.generatePOM && features.length > 0) {
    const pagesFolder = root.folder('pages')!
    for (const feature of features) {
      const featureTCs = testCases.filter((tc) => tc.featureId === feature.id)
      if (featureTCs.length === 0) continue
      const pomContent = generatePOM(feature, featureTCs, project.language)
      pagesFolder.file(
        `${slug(feature.name)}Page.${ext}`,
        pomContent
      )
    }
  }

  // tests — group by serial chains where same-feature deps exist
  const allTCIds = new Set(testCases.map((tc) => tc.id))
  const testsFolder = root.folder('tests')!
  for (const feature of features) {
    const featureTCs = testCases.filter((tc) => tc.featureId === feature.id)
    if (featureTCs.length === 0) continue
    const featureFolder = testsFolder.folder(slug(feature.name))!

    const groups = getSameFeatureSerialGroups(feature.id, testCases)

    for (const group of groups) {
      if (group.length === 0) continue
      const isSerial = group.length > 1 && group.some((tc) =>
        (tc.dependencies ?? []).some((dep) => featureTCs.some((t) => t.id === dep))
      )

      // Cross-feature dep comments for the first TC in the group
      const crossFeatureDeps: string[] = []
      for (const tc of group) {
        for (const depId of tc.dependencies ?? []) {
          if (!allTCIds.has(depId)) continue
          const depTc = testCases.find((t) => t.id === depId)
          if (!depTc || depTc.featureId === feature.id) continue
          const depFeature = features.find((f) => f.id === depTc.featureId)
          if (depFeature) {
            const path = `tests/${slug(depFeature.name)}/${slug(depTc.name)}.spec.${ext}`
            if (!crossFeatureDeps.includes(path)) crossFeatureDeps.push(path)
          }
        }
      }

      if (isSerial) {
        // Generate one combined file for the serial group
        const groupName = group.map((tc) => slug(tc.name)).join('-')
        const specContent = generateSpecFile(feature, group, variables, utils, fixtures, project, {
          serial: true,
          crossFeatureDeps,
        })
        featureFolder.file(`${groupName}.serial.spec.${ext}`, specContent)
      } else {
        // Individual files
        for (const tc of group) {
          const specContent = generateSpecFile(feature, [tc], variables, utils, fixtures, project, {
            serial: false,
            crossFeatureDeps: group[0].id === tc.id ? crossFeatureDeps : [],
          })
          featureFolder.file(`${slug(tc.name)}.spec.${ext}`, specContent)
        }
      }
    }
  }

  // Run order script (only when dependencies exist)
  const hasDeps = testCases.some((tc) => (tc.dependencies?.length ?? 0) > 0)
  if (hasDeps) {
    root.file('run-ordered.sh', generateRunOrderScript(features, testCases, ext))
  }

  // CI/CD configs
  if (project.cicd && project.cicd.platforms.length > 0) {
    for (const platform of project.cicd.platforms) {
      const content = generateCiConfig(project, project.cicd, platform)
      const filepath = CI_PLATFORM_META[platform].filename
      // filepath may be nested (e.g. .github/workflows/playwright.yml)
      const parts = filepath.split('/')
      const filename = parts.pop()!
      let folder = root
      for (const part of parts) {
        folder = folder.folder(part)!
      }
      folder.file(filename, content)
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug(project.name)}-playwright.zip`
  a.click()
  URL.revokeObjectURL(url)
}
