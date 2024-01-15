type SizedTexture = {
  texture: WebGLTexture;
  width: number;
  height: number;
}

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
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

function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
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

// Set a rectangle that covers the NDC space
function setRectangle(gl: WebGLRenderingContext) {
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1.0, -1.0,   // Bottom left
    1.0, -1.0,   // Bottom right
    -1.0,  1.0,   // Top left
    -1.0,  1.0,   // Top left
    1.0, -1.0,   // Bottom right
    1.0,  1.0,   // Top right
  ]), gl.STATIC_DRAW);
}

function runShaderProgram(gl: WebGLRenderingContext, program: WebGLProgram, width: number, height: number): void {
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

function runShaderProgramToTexture(gl: WebGLRenderingContext, program: WebGLProgram, width: number, height: number): SizedTexture {
  const targetTexture = gl.createTexture();
  if (targetTexture == null) {
    throw new Error("Failed to create texture");
  }
  gl.bindTexture(gl.TEXTURE_2D, targetTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);  // Prevents s-coordinate wrapping (repeating).
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);  // Prevents t-coordinate wrapping (repeating).

  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

  const attachmentPoint = gl.COLOR_ATTACHMENT0;
  gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, targetTexture, 0);

  runShaderProgram(gl, program, width, height);
  return {texture: targetTexture, width: width, height: height};
}

function renderTextureToCanvas(gl: WebGLRenderingContext, stex: SizedTexture, canvas: HTMLCanvasElement): void {
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

function main(): void {
  var webglCanvas = document.getElementById("webgl-canvas") as HTMLCanvasElement;
  var drawCanvas = document.getElementById("draw-canvas") as HTMLCanvasElement;
  var width = 500;
  var height = 500;
  var gl = webglCanvas.getContext("webgl");
  if (!gl) {
    return;
  }

  // Vertex shader program
  var vertexShaderSource = `
    attribute vec4 a_position;
    void main() {
        gl_Position = a_position;
    }
    `;

  // Fragment shader program
  var fragmentShaderSource = `
    precision mediump float;
    void main() {
        gl_FragColor = vec4(1, 0, 0.5, 1);  // Purple color
    }
    `;

  var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  var program = createProgram(gl, vertexShader, fragmentShader);
  // runShaderProgram(gl, program, gl.canvas.width, gl.canvas.height);
  console.log('to texture...');
  var stex = runShaderProgramToTexture(gl, program, width, height);
  console.log('to canvas...');
  renderTextureToCanvas(gl, stex, drawCanvas);
}

main();
