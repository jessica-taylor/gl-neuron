
export type GLCtx = WebGL2RenderingContext;

export type FormatConfig = {
  internalFormat: number;
  format: number;
  numberType: number;
}

export type SizedTexture = {
  texture: WebGLTexture;
  width: number;
  height: number,
  format: FormatConfig;
}

export type ShaderParameters = {
  textureParameters?: Record<string, SizedTexture>;
  vec4Parameters?: Record<string, number[]>;
  intParameters?: Record<string, number>;
}

// see: https://registry.khronos.org/webgl/specs/latest/2.0/#TEXTURE_TYPES_FORMATS_FROM_DOM_ELEMENTS_TABLE
export const FormatConfigs = {
  rgb_byte: {internalFormat: WebGL2RenderingContext.RGB, format: WebGL2RenderingContext.RGB, numberType: WebGL2RenderingContext.UNSIGNED_BYTE},
  rgba_byte: {internalFormat: WebGL2RenderingContext.RGBA, format: WebGL2RenderingContext.RGBA, numberType: WebGL2RenderingContext.UNSIGNED_BYTE},
};


export function newGLContext(): GLCtx {
  var canvas = document.createElement("canvas");
  var gl = canvas.getContext("webgl2");
  if (!gl) {
    throw new Error("Failed to get webgl context");
  }
  return gl;
}

export function createShader(gl: GLCtx, type: number, source: string): WebGLShader {
  source = '#version 300 es\n' + source;
  var shader = gl.createShader(type);
  if (shader == null) {
    throw new Error("Failed to create shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }
  console.log("FAILED: " + source);

  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  throw new Error("Failed to compile shader");
}

export function getSquareVertexShader(gl: GLCtx): WebGLShader {
  var vertexShaderSource = `
    in vec4 a_position;
    void main() {
        gl_Position = a_position;
    } `;
  return createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
}

export function createProgram(gl: GLCtx, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
  var program = gl.createProgram();
  if (program == null) {
    throw new Error("Failed to create program");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }
  console.log("FAILED PROGRAM ", vertexShader, fragmentShader);

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
  throw new Error("Failed to compile program");
}

export function createSquareProgram(gl: GLCtx, fragmentShaderSource: string): WebGLProgram {
  var vertexShader = getSquareVertexShader(gl);
  var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  return createProgram(gl, vertexShader, fragmentShader);
}

// Set a rectangle that covers the NDC space
export function setRectangle(gl: GLCtx) {
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1.0, -1.0,   // Bottom left
    1.0, -1.0,   // Bottom right
    -1.0,  1.0,   // Top left
    -1.0,  1.0,   // Top left
    1.0, -1.0,   // Bottom right
    1.0,  1.0,   // Top right
  ]), gl.STATIC_DRAW);
}

export function setupShaderParameters(gl: GLCtx, params: ShaderParameters): void {
  const textureParams = params.textureParameters;
  if (textureParams) {
    const keys = Object.keys(textureParams);
    keys.sort();
    for (var i = 0; i < keys.length; i++) {
      const texName = keys[i];
      const stex = textureParams[texName];
      const ix = i + 1;
      gl.activeTexture(gl.TEXTURE0 + ix);
      gl.bindTexture(gl.TEXTURE_2D, stex.texture);
      const uniformLocation = gl.getUniformLocation(gl.getParameter(gl.CURRENT_PROGRAM), texName);
      if (uniformLocation == null) {
        throw new Error("Failed to get uniform location for " + texName);
      }
      gl.uniform1i(uniformLocation, ix);
    }
  }
  function setParams<T>(params: Record<string, T> | undefined, glFunc: (loc: WebGLUniformLocation, val: T) => void): void {
    if (params) {
      for (var name in params) {
        const uniformLocation = gl.getUniformLocation(gl.getParameter(gl.CURRENT_PROGRAM), name);
        if (uniformLocation == null) {
          throw new Error("Failed to get uniform location for " + name);
        }
        glFunc(uniformLocation, params[name]);
      }
    }
  }
  setParams(params.vec4Parameters, gl.uniform4fv.bind(gl));
  setParams(params.intParameters, gl.uniform1i.bind(gl));
}

export function uniformDefined(gl: GLCtx, name: string): boolean {
  const uniformLocation = gl.getUniformLocation(gl.getParameter(gl.CURRENT_PROGRAM), name);
  return uniformLocation != null;
}


export function runShaderProgram(gl: GLCtx, program: WebGLProgram, width: number, height: number, params: ShaderParameters = {}): void {
  var positionAttributeLocation = gl.getAttribLocation(program, "a_position");

  var positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  setRectangle(gl);

  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);

  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  if (!params.intParameters) {
    params.intParameters = {};
  }
  if (uniformDefined(gl, 'target_width')) {
    params.intParameters.target_width = width;
  }
  if (uniformDefined(gl, 'target_height')) {
    params.intParameters.target_height = height;
  }
  setupShaderParameters(gl, params);

  var size = 2;          // 2 components per iteration
  var type = gl.FLOAT;   // the data is 32bit floats
  var normalize = false; // don't normalize the data
  var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0;        // start at the beginning of the buffer
  gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);

  var primitiveType = gl.TRIANGLES;
  var offset = 0;
  var count = 6;  // 6 vertices = 2 triangles
  gl.drawArrays(primitiveType, offset, count);
}

export function newTexture(gl: GLCtx, width: number, height: number, formatCfg: FormatConfig): SizedTexture {
  const targetTexture = gl.createTexture();
  if (targetTexture == null) {
    throw new Error("Failed to create texture");
  }
  gl.bindTexture(gl.TEXTURE_2D, targetTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, formatCfg.internalFormat, width, height, 0, formatCfg.format, formatCfg.numberType, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);  // Prevents s-coordinate wrapping (repeating).
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);  // Prevents t-coordinate wrapping (repeating).
  return {texture: targetTexture, width, height, format: formatCfg};
}

export function runShaderProgramToTexture(gl: GLCtx, program: WebGLProgram, target: SizedTexture, params: ShaderParameters = {}): void {

  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

  const attachmentPoint = gl.COLOR_ATTACHMENT0;
  gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, target.texture, 0);

  runShaderProgram(gl, program, target.width, target.height, params);
}

export function renderTextureToCanvas(gl: GLCtx, stex: SizedTexture, canvas: HTMLCanvasElement): void {
  // Ensure the canvas dimensions match the texture dimensions
  canvas.width = stex.width;
  canvas.height = stex.height;

  gl.bindTexture(gl.TEXTURE_2D, stex.texture);
  console.log('bound texture2');

  // Create and bind a framebuffer
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

  // Attach the texture to the framebuffer
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, stex.texture, 0);

  // Check if the framebuffer is complete
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("Framebuffer is not complete");
  }
  const pixels = new Uint8Array(stex.width * stex.height * 4);
  gl.readPixels(0, 0, stex.width, stex.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const ctx = canvas.getContext("2d");
  if (ctx == null) {
    throw new Error("Failed to get 2d context");
  }
  const imageData = new ImageData(new Uint8ClampedArray(pixels), stex.width, stex.height);
  ctx.putImageData(imageData, 0, 0);
}
