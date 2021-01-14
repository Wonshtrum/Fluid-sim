'use strict';


function initWebGL(canvas) {
	let gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, premultipliedAlpha: false });
	gl.getExtension('EXT_color_buffer_float');
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	return gl;
}

const canvas = document.getElementById("context");
const gl = initWebGL(canvas);