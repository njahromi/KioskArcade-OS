/**
 * Minimal WebGL probe for boot diagnostics (renderer process).
 */
export function runWebglSelfTest(): { readonly ok: boolean; readonly error?: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) {
      return { ok: false, error: 'WebGL context is not available' };
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const err = gl.getError();
    if (err !== gl.NO_ERROR) {
      return { ok: false, error: `WebGL reported error code ${err}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'WebGL self-test failed' };
  }
}
