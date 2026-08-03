import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactPath = resolve(
  packageRoot,
  "../contracts/artifacts/contracts/AdMon.sol/AdMon.json"
);
const outputPath = resolve(packageRoot, "src/abis/admon.ts");
const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
const output = `// ABI origin: compiled from contracts/contracts/AdMon.sol by Hardhat.\n// Regenerate with: npm run sync:abi --workspace moss-adapter\nexport const AdMonAbi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, output);
