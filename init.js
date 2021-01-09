'use strict';

const vertexShader = compileShader(gl.VERTEX_SHADER, `
	precision mediump float;
	layout(location = 0) in vec2 a_position;
	out vec2 v_position;

	void main () {
		v_position = a_position;
		gl_Position = vec4(a_position*2.0-1.0, 0, 1);
	}
`);
const fragmentShader = compileShader(gl.FRAGMENT_SHADER, `
	precision mediump float;
	in vec2 v_position;
	layout(location = 0) out vec4 baseColor;
	layout(location = 1) out vec4 brightColor;

	void main () {
		baseColor = vec4(v_position, 0.3, 1);
		if (distance(v_position, vec2(0.5))>0.2) {
			brightColor = vec4(v_position, 0.3, 1);
		}
	}
`);

const program = new Shader(vertexShader, fragmentShader);
program.bind();
const fb = new FBO(["main"], 100, 100);
const fbm = new RWFBO(["base", "bright"], 100, 100);

blit(fb);
blit(fbm.write);
fbm.swap();
transferTarget(fbm.read.textures.bright, true);

function update () {
	const dt = 0.16;
	applyInputs();
	step(dt);
	render(null);
	requestAnimationFrame(update);
}