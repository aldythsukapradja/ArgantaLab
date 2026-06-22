import type { HQDataSource } from './HQDataSource'
import { MANIFESTS, PRODUCT_NORTH_STARS, ROLLUPS, APP_HEALTH, SIGNALS } from './seed'

export class MockDataSource implements HQDataSource {
  async listManifests() { return MANIFESTS }
  async productNorthStars() { return PRODUCT_NORTH_STARS }
  async portfolioRollup(product: string) { return ROLLUPS[product] ?? ROLLUPS.portfolio }
  async appHealth() { return APP_HEALTH }
  async signals() { return SIGNALS }
}
