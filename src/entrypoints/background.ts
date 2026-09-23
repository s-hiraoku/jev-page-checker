import definitionRaw from "../../fixtures/page-credibility.checker.json" with { type: "json" };
import { startBackground } from "../lib/background-runtime.js";
import { buildCategoryDefinition } from "../lib/category-definition.js";
import { parseDefinition } from "../lib/checkkit.js";

export default defineBackground(() => {
  startBackground(buildCategoryDefinition(parseDefinition(definitionRaw)));
});
