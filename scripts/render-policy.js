// Software rasterizers caused repeated host crashes in WSL. Keep those on readable HTML.
export function isSoftwareRenderer(name='') {
  return /swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render/i.test(name);
}
