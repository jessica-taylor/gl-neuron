import {GLCtx, SizedTexture, FormatConfigs, newGLContext, createSquareProgram, newTexture, runShaderProgramToTexture, renderTextureToCanvas, copyTexture}  from './basic';

function renderSolidColorTexture(gl: GLCtx, stex: SizedTexture, color: number[]): void {
  var fragmentShaderSource = `
    precision mediump float;
    uniform vec4 u_color;
    out vec4 fragColor;
    void main() {
        fragColor = u_color;
    }
    `;
  var program = createSquareProgram(gl, fragmentShaderSource);
  var params = {vec4Parameters: {u_color: color}};
  runShaderProgramToTexture(gl, program, stex, params);
}

function renderInverseTexture(gl: GLCtx, stex: SizedTexture, target: SizedTexture): void {
  var fragmentShaderSource = `
    precision mediump float;
    out vec4 fragColor;
    uniform int target_width;
    uniform int target_height;
    uniform sampler2D u_texture;
    void main() {
        vec4 color = texelFetch(u_texture, ivec2(int(gl_FragCoord.x), int(gl_FragCoord.y)), 0);
        fragColor = vec4(1.0 - color.r, 1.0 - color.g, 1.0 - color.b, 1.0);
    }
    `;
  var program = createSquareProgram(gl, fragmentShaderSource);
  var params = {textureParameters: {u_texture: stex}};
  runShaderProgramToTexture(gl, program, target, params);
}

function perfTest(): void {
  var drawCanvas = document.getElementById("draw-canvas") as HTMLCanvasElement;
  var width = 500;
  var height = 500;
  var gl = newGLContext();

  var fragmentShaderSource = `
    precision lowp float;
    out vec4 fragColor;

    uniform int target_width;
    uniform int target_height;
    void main() {
      float x = gl_FragCoord.x + gl_FragCoord.y * 1111.11;
      for (int i = 0; i < 1000000; ++i) {
        x = x * x;
        // x = x - 1000.0 * floor(x / 1000.0);
      }
      fragColor = vec4(x / 1000.0, 0.0, 0.0, 1.0);
    }
    `;
  var program = createSquareProgram(gl, fragmentShaderSource);
  var startTime = performance.now();
  var texture = newTexture(gl, width, height, FormatConfigs.rgba_byte);
  runShaderProgramToTexture(gl, program, texture);
  renderTextureToCanvas(gl, texture, drawCanvas);
  var endTime = performance.now();
  console.log('time: ' + (endTime - startTime));
}


function main(): void {
  // perfTest();
  // return;
  var drawCanvas = document.getElementById("draw-canvas") as HTMLCanvasElement;
  var width = 500;
  var height = 500;
  var gl = newGLContext();

  console.log('max texture size', gl.getParameter(gl.MAX_TEXTURE_SIZE), '3d', gl.getParameter(gl.MAX_3D_TEXTURE_SIZE));

  var solidTexture = newTexture(gl, width, height, FormatConfigs.r_float);
  renderSolidColorTexture(gl, solidTexture, [1, 0, 0, 1]);
  var inverseTexture = newTexture(gl, width, height, FormatConfigs.rg_float);
  renderInverseTexture(gl, solidTexture, inverseTexture);
  var canvTexture = newTexture(gl, width, height, FormatConfigs.rg_byte);
  copyTexture(gl, inverseTexture, canvTexture);

  console.log('to canvas...');
  renderTextureToCanvas(gl, canvTexture, drawCanvas);
}

main();
