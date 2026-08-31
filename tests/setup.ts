import { vi } from 'vitest';

// WebGL Mock Constants
const GL_CONSTANTS: Record<string, number> = {
  VERTEX_SHADER: 0x8b31,
  FRAGMENT_SHADER: 0x8b30,
  COMPILE_STATUS: 0x8b81,
  LINK_STATUS: 0x8b82,
  ARRAY_BUFFER: 0x8892,
  ELEMENT_ARRAY_BUFFER: 0x8893,
  STATIC_DRAW: 0x88e4,
  DYNAMIC_DRAW: 0x88e8,
  STREAM_DRAW: 0x88e0,
  FLOAT: 0x1406,
  UNSIGNED_BYTE: 0x1401,
  UNSIGNED_SHORT: 0x1403,
  UNSIGNED_INT: 0x1405,
  COLOR_BUFFER_BIT: 0x00004000,
  DEPTH_BUFFER_BIT: 0x00000100,
  BLEND: 0x0be2,
  DEPTH_TEST: 0x0b71,
  CULL_FACE: 0x0b44,
  SRC_ALPHA: 0x0302,
  ONE_MINUS_SRC_ALPHA: 0x0303,
  ONE: 1,
  ZERO: 0,
  TRIANGLES: 0x0004,
  TRIANGLE_STRIP: 0x0005,
  LINES: 0x0001,
  POINTS: 0x0000,
  TEXTURE_2D: 0x0de1,
  TEXTURE0: 0x84c0,
  RGBA: 0x1908,
  LINEAR: 0x2601,
  NEAREST: 0x2600,
  CLAMP_TO_EDGE: 0x812f,
  REPEAT: 0x2901,
  TEXTURE_MIN_FILTER: 0x2801,
  TEXTURE_MAG_FILTER: 0x2800,
  TEXTURE_WRAP_S: 0x2802,
  TEXTURE_WRAP_T: 0x2803,
  UNPACK_FLIP_Y_WEBGL: 0x9240,
  NO_ERROR: 0,
};

export class MockWebGLRenderingContext {
  canvas: HTMLCanvasElement;
  uniforms: Map<string, any> = new Map();
  programs: Set<any> = new Set();
  buffers: Set<any> = new Set();
  textures: Set<any> = new Set();
  shaders: Set<any> = new Set();
  isLost = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    Object.assign(this, GL_CONSTANTS);
  }

  createShader = vi.fn((type: number) => {
    const shader = { type, source: '', id: Math.random() };
    this.shaders.add(shader);
    return shader;
  });

  shaderSource = vi.fn((shader: any, source: string) => {
    if (shader) shader.source = source;
  });

  compileShader = vi.fn((_shader: any) => {});

  getShaderParameter = vi.fn((_shader: any, pname: number) => {
    if (pname === GL_CONSTANTS.COMPILE_STATUS) return true;
    return true;
  });

  getShaderInfoLog = vi.fn(() => '');

  deleteShader = vi.fn((shader: any) => {
    this.shaders.delete(shader);
  });

  createProgram = vi.fn(() => {
    const prog = { id: Math.random(), shaders: [] as any[], uniforms: new Map() };
    this.programs.add(prog);
    return prog;
  });

  attachShader = vi.fn((prog: any, shader: any) => {
    if (prog) prog.shaders.push(shader);
  });

  linkProgram = vi.fn((_prog: any) => {});

  getProgramParameter = vi.fn((_prog: any, pname: number) => {
    if (pname === GL_CONSTANTS.LINK_STATUS) return true;
    return true;
  });

  getProgramInfoLog = vi.fn(() => '');

  useProgram = vi.fn((_prog: any) => {});

  deleteProgram = vi.fn((prog: any) => {
    this.programs.delete(prog);
  });

  getAttribLocation = vi.fn((_prog: any, _name: string) => 0);
  enableVertexAttribArray = vi.fn((_index: number) => {});
  disableVertexAttribArray = vi.fn((_index: number) => {});
  vertexAttribPointer = vi.fn(() => {});

  getUniformLocation = vi.fn((_prog: any, name: string) => ({ name }));

  uniform1f = vi.fn((loc: any, v0: number) => {
    if (loc?.name) this.uniforms.set(loc.name, v0);
  });
  uniform2f = vi.fn((loc: any, v0: number, v1: number) => {
    if (loc?.name) this.uniforms.set(loc.name, [v0, v1]);
  });
  uniform3f = vi.fn((loc: any, v0: number, v1: number, v2: number) => {
    if (loc?.name) this.uniforms.set(loc.name, [v0, v1, v2]);
  });
  uniform4f = vi.fn((loc: any, v0: number, v1: number, v2: number, v3: number) => {
    if (loc?.name) this.uniforms.set(loc.name, [v0, v1, v2, v3]);
  });
  uniform1i = vi.fn((loc: any, v0: number) => {
    if (loc?.name) this.uniforms.set(loc.name, v0);
  });
  uniformMatrix3fv = vi.fn((loc: any, _transpose: boolean, val: Float32Array | number[]) => {
    if (loc?.name) this.uniforms.set(loc.name, val);
  });
  uniformMatrix4fv = vi.fn((loc: any, _transpose: boolean, val: Float32Array | number[]) => {
    if (loc?.name) this.uniforms.set(loc.name, val);
  });

  createBuffer = vi.fn(() => {
    const buf = { id: Math.random(), data: null };
    this.buffers.add(buf);
    return buf;
  });

  bindBuffer = vi.fn((_target: number, _buffer: any) => {});
  bufferData = vi.fn((_target: number, data: any, _usage: number) => {
    return data;
  });
  bufferSubData = vi.fn(() => {});
  deleteBuffer = vi.fn((buf: any) => {
    this.buffers.delete(buf);
  });

  createTexture = vi.fn(() => {
    const tex = { id: Math.random() };
    this.textures.add(tex);
    return tex;
  });
  bindTexture = vi.fn(() => {});
  texParameteri = vi.fn(() => {});
  texImage2D = vi.fn(() => {});
  activeTexture = vi.fn(() => {});
  deleteTexture = vi.fn((tex: any) => {
    this.textures.delete(tex);
  });
  pixelStorei = vi.fn(() => {});

  viewport = vi.fn((_x: number, _y: number, _w: number, _h: number) => {});
  clearColor = vi.fn(() => {});
  clear = vi.fn(() => {});
  enable = vi.fn(() => {});
  disable = vi.fn(() => {});
  blendFunc = vi.fn(() => {});
  drawArrays = vi.fn((_mode: number, _first: number, _count: number) => {});
  drawElements = vi.fn(() => {});
  getError = vi.fn(() => GL_CONSTANTS.NO_ERROR);

  getExtension = vi.fn((_name: string) => ({
    loseContext: () => {
      this.isLost = true;
      this.canvas.dispatchEvent(new Event('webglcontextlost'));
    },
    restoreContext: () => {
      this.isLost = false;
      this.canvas.dispatchEvent(new Event('webglcontextrestored'));
    },
  }));

  isContextLost = vi.fn(() => this.isLost);
}

// Attach WebGL mock to HTMLCanvasElement prototype
const originalGetContext = HTMLCanvasElement.prototype.getContext;

HTMLCanvasElement.prototype.getContext = function (contextType: string, ...args: any[]) {
  if (contextType === 'webgl' || contextType === 'webgl2' || contextType === 'experimental-webgl') {
    if (!(this as any).__mockGL) {
      (this as any).__mockGL = new MockWebGLRenderingContext(this);
    }
    return (this as any).__mockGL;
  }
  if (contextType === '2d') {
    return {
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      putImageData: vi.fn(),
      createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      measureText: vi.fn(() => ({ width: 50 })),
      canvas: this,
    };
  }
  return originalGetContext.call(this, contextType as any, ...args);
} as any;

// Mock ResizeObserver
export class MockResizeObserver {
  callback: ResizeObserverCallback;
  elements: Set<Element> = new Set();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(element: Element) {
    this.elements.add(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }

  trigger(entries: Partial<ResizeObserverEntry>[]) {
    this.callback(entries as ResizeObserverEntry[], this as unknown as ResizeObserver);
  }
}

globalThis.ResizeObserver = MockResizeObserver as any;
window.ResizeObserver = MockResizeObserver as any;

// Mock requestAnimationFrame and cancelAnimationFrame if missing
if (!globalThis.requestAnimationFrame) {
  let lastTime = 0;
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    const currTime = Date.now();
    const timeToCall = Math.max(0, 16 - (currTime - lastTime));
    const id = setTimeout(() => callback(currTime + timeToCall), timeToCall) as unknown as number;
    lastTime = currTime + timeToCall;
    return id;
  };
}

if (!globalThis.cancelAnimationFrame) {
  globalThis.cancelAnimationFrame = (id: number): void => {
    clearTimeout(id);
  };
}

// Mock matchMedia
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
