import JSZip from 'jszip'
import type { Project, Feature, TestCase, GlobalVariable, ReusableUtil, Fixture } from '../types'
import {
  generateConfig,
  generateGlobalSetup,
  generateConstants,
  generateEnvFile,
  generateUtilHelper,
  generateFixtureFile,
  generatePOM,
  generateSpecFile,
} from './codeGenerator'

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
  const { project, features, testCases, variables, utils, fixtures } = input
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

  // tests
  const testsFolder = root.folder('tests')!
  for (const feature of features) {
    const featureTCs = testCases.filter((tc) => tc.featureId === feature.id)
    if (featureTCs.length === 0) continue
    const featureFolder = testsFolder.folder(slug(feature.name))!
    for (const tc of featureTCs) {
      const specContent = generateSpecFile(
        feature,
        [tc],
        variables,
        utils,
        fixtures,
        project
      )
      featureFolder.file(`${slug(tc.name)}.spec.${ext}`, specContent)
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
