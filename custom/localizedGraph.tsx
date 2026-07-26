import CoreGraph, { D3Config } from "../quartz/components/Graph"
import { QuartzComponentConstructor } from "../quartz/components/types"
import { buildLocalizedGraphScript } from "./localizedGraphScript"

interface LocalizedGraphOptions {
  localGraph: Partial<D3Config> | undefined
  globalGraph: Partial<D3Config> | undefined
}

const localizedGraphScript = buildLocalizedGraphScript()

export default ((opts?: Partial<LocalizedGraphOptions>) => {
  const Graph = CoreGraph(opts)
  Graph.afterDOMLoaded = localizedGraphScript
  return Graph
}) satisfies QuartzComponentConstructor<Partial<LocalizedGraphOptions> | undefined>
