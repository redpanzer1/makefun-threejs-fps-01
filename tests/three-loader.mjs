// Maps the bare 'three' import to the vendored module for headless Node tests.
import { pathToFileURL } from 'node:url';
const VENDORED = pathToFileURL('/home/hatch/workspace/makefun/threejs-fps-01/game/vendor/three/three.module.min.js').href;
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') return { url: VENDORED, shortCircuit: true };
  return nextResolve(specifier, context);
}
