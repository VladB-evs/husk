// Gives the packaged app an "ad-hoc" signature. Apple Silicon Macs refuse to start code that has no signature at
// all, and an ad-hoc signature costs nothing. It does not identify a developer: macOS still treats the app as
// coming from an unknown developer. See "Sharing the app" in the README.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
};
