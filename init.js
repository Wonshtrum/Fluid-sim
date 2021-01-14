'use strict';


const general_vsh = compileShader(gl.VERTEX_SHADER, `
	precision highp float;

	layout(location = 0) in vec2 a_position;
	out vec2 v_P;
	out vec2 v_L;
	out vec2 v_R;
	out vec2 v_T;
	out vec2 v_B;

	uniform vec2 u_texelSize;

	void main () {
		v_P = a_position;
		v_L = v_P - vec2(u_texelSize.x, 0.0);
		v_R = v_P + vec2(u_texelSize.x, 0.0);
		v_T = v_P + vec2(0.0, u_texelSize.y);
		v_B = v_P - vec2(0.0, u_texelSize.y);
		gl_Position = vec4(a_position*2.0-1.0, 0, 1);
	}
`);
const clear_fsh = compileShader(gl.FRAGMENT_SHADER, `
	precision highp float;

	layout(location = 0) out vec4 outColor;

	uniform vec4 u_color;

	void main () {
		outColor = u_color;
	}
`);
const splat_fsh = compileShader(gl.FRAGMENT_SHADER, `
	precision highp float;
	precision highp sampler2D;

	in vec2 v_P;
	layout(location = 0) out vec4 outColor;

	uniform sampler2D u_base;
	uniform float u_aspectRatio;
	uniform vec3 u_color;
	uniform vec2 u_point;
	uniform float u_radius;

	void main () {
		vec2 p = v_P - u_point.xy;
		p.x *= u_aspectRatio;
		vec3 splat = exp(-dot(p, p) / u_radius) * u_color;
		vec3 base = texture(u_base, v_P).xyz;
		outColor = vec4(base + splat, 1);
	}
`);
const curl_fsh = compileShader(gl.FRAGMENT_SHADER, `
	precision mediump float;
	precision mediump sampler2D;

	in vec2 v_P;
	in vec2 v_L;
	in vec2 v_R;
	in vec2 v_T;
	in vec2 v_B;
	layout(location = 0) out vec4 outColor;

	uniform sampler2D u_velocity;

	void main () {
		float L = texture(u_velocity, v_L).y;
		float R = texture(u_velocity, v_R).y;
		float T = texture(u_velocity, v_T).x;
		float B = texture(u_velocity, v_B).x;
		float vorticity = R - L - T + B;
		outColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
	}
`);
const vorticity_fsh = compileShader(gl.FRAGMENT_SHADER, `
	precision highp float;
	precision highp sampler2D;

	in vec2 v_P;
	in vec2 v_L;
	in vec2 v_R;
	in vec2 v_T;
	in vec2 v_B;
	layout(location = 0) out vec4 outColor;

	uniform sampler2D u_velocity;
	uniform sampler2D u_curl;
	uniform float u_coef;
	uniform float u_dt;

	void main () {
		float L = texture(u_curl, v_L).x;
		float R = texture(u_curl, v_R).x;
		float T = texture(u_curl, v_T).x;
		float B = texture(u_curl, v_B).x;
		float C = texture(u_curl, v_P).x;

		vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
		force /= length(force) + 0.0001;
		force *= u_coef * C;
		force.y *= -1.0;

		vec2 velocity = texture(u_velocity, v_P).xy;
		velocity += force * u_dt;
		velocity = min(max(velocity, -1000.0), 1000.0);
		outColor = vec4(velocity, 0.0, 1.0);
	}
`);
const divergence_fsh = compileShader(gl.FRAGMENT_SHADER, `
	precision mediump float;
	precision mediump sampler2D;

	in vec2 v_P;
	in vec2 v_L;
	in vec2 v_R;
	in vec2 v_T;
	in vec2 v_B;
	layout(location = 0) out vec4 outColor;

	uniform sampler2D u_velocity;

	void main () {
		float L = texture(u_velocity, v_L).x;
		float R = texture(u_velocity, v_R).x;
		float T = texture(u_velocity, v_T).y;
		float B = texture(u_velocity, v_B).y;

		vec2 C = texture(u_velocity, v_P).xy;
		if (v_L.x < 0.0) { L = -C.x; }
		if (v_R.x > 1.0) { R = -C.x; }
		if (v_T.y > 1.0) { T = -C.y; }
		if (v_B.y < 0.0) { B = -C.y; }

		float div = 0.5 * (R - L + T - B);
		outColor = vec4(div, 0.0, 0.0, 1.0);
	}
`);
const pressure_fsh = compileShader(gl.FRAGMENT_SHADER, `
	precision mediump float;
	precision mediump sampler2D;

	in vec2 v_P;
	in vec2 v_L;
	in vec2 v_R;
	in vec2 v_T;
	in vec2 v_B;
	layout(location = 0) out vec4 outColor;

	uniform sampler2D u_pressure;
	uniform sampler2D u_divergence;

	void main () {
		float L = texture(u_pressure, v_L).x;
		float R = texture(u_pressure, v_R).x;
		float T = texture(u_pressure, v_T).x;
		float B = texture(u_pressure, v_B).x;
		float C = texture(u_pressure, v_P).x;
		float divergence = texture(u_divergence, v_P).x;
		float pressure = (L + R + B + T - divergence) * 0.25;
		outColor = vec4(pressure, 0.0, 0.0, 1.0);
	}
`);

const gradientSubtract_fsh = compileShader(gl.FRAGMENT_SHADER, `
	precision mediump float;
	precision mediump sampler2D;

	in vec2 v_P;
	in vec2 v_L;
	in vec2 v_R;
	in vec2 v_T;
	in vec2 v_B;
	layout(location = 0) out vec4 outColor;

	uniform sampler2D u_pressure;
	uniform sampler2D u_velocity;

	void main () {
		float L = texture(u_pressure, v_L).x;
		float R = texture(u_pressure, v_R).x;
		float T = texture(u_pressure, v_T).x;
		float B = texture(u_pressure, v_B).x;
		vec2 velocity = texture(u_velocity, v_P).xy;
		velocity.xy -= vec2(R - L, T - B);
		outColor = vec4(velocity, 0.0, 1.0);
	}
`);
const advection_fsh = compileShader(gl.FRAGMENT_SHADER, `
	precision highp float;
	precision highp sampler2D;

	in vec2 v_P;
	layout(location = 0) out vec4 outColor;

	uniform sampler2D u_velocity;
	uniform sampler2D u_source;
	uniform vec2 u_texelSize;
	uniform float u_dt;
	uniform float u_dissipation;

	void main () {
		vec2 coord = v_P - u_dt * texture(u_velocity, v_P).xy * u_texelSize;
		vec4 result = texture(u_source, coord);
		float decay = 1.0 + u_dissipation * u_dt;
		outColor = result / decay;
	}`,
);
const obstacle_fsh = compileShader(gl.FRAGMENT_SHADER, `
	precision highp float;
	precision highp sampler2D;

	in vec2 v_P;
	layout(location = 0) out vec4 outColor;

	uniform sampler2D u_source;

	void main () {
		vec4 base = texture(u_source, v_P);
		if (length(v_P - vec2(0.5))>0.1) {
			outColor = base;
		} else {
			outColor = vec4(0,0,1,1);
		}
	}`,
);

const config = {
	CURL: 20,
	ITERATIONS: 10,
	FORCE: 6000,
	VELOCITY_DISSIPATION: 0.2,
	DYE_DISSIPATION: 0.5,
	DENSITY: 0.1,
	PRESSURE: 1.8,
	RADIUS: 0.2,
	STOP_ON_HALT: false,
}

const resolution = 128;
const velocity = new RWFBO(["main"], resolution, resolution, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
const pressure = new RWFBO(["main"], resolution, resolution, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
//gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE
const curl = new FBO(["main"], resolution, resolution, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
const divergence = new FBO(["main"], resolution, resolution, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);

let dyeResolution = null;
let dye = null
let activeTarget = dye;
function setDyeResolution(resolution) {
	dyeResolution = resolution;
	let newDye = new RWFBO(["main"], dyeResolution, dyeResolution, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
	if (activeTarget === dye) {
		activeTarget = newDye;
	}
	dye = newDye;
	canvas.width = dyeResolution;
	canvas.height = dyeResolution;
}
setDyeResolution(512);


const clearProgram = new Shader(general_vsh, clear_fsh);
const splatProgram = new Shader(general_vsh, splat_fsh);
const curlProgram = new Shader(general_vsh, curl_fsh);
const vorticityProgram = new Shader(general_vsh, vorticity_fsh);
const divergenceProgram = new Shader(general_vsh, divergence_fsh);
const pressureProgram = new Shader(general_vsh, pressure_fsh);
const gradienSubtractProgram = new Shader(general_vsh, gradientSubtract_fsh);
const advectionProgram = new Shader(general_vsh, advection_fsh);
const obstacleProgram = new Shader(general_vsh, obstacle_fsh);

function update () {
	const dt = 0.01;
	applyInputs();
	step(dt);
	if (activeTarget instanceof RWFBO) {
		transferTarget(activeTarget.read.texture, true);
	} else {
		transferTarget(activeTarget.texture, true);
	}
	requestAnimationFrame(update);
}
update();

function applyInputs() {
	if (Cursor.moved) {
		Cursor.moved = !config.STOP_ON_HALT;
		splat(Cursor.coordX, Cursor.coordY, Cursor.coordX - Cursor.prevCoordX, Cursor.coordY - Cursor.prevCoordY)
	}
}

function splat(x, y, dx, dy) {
	splatProgram.bind();
	gl.uniform1i(splatProgram.uniforms.u_base, velocity.read.texture.attach(0));
	gl.uniform1f(splatProgram.uniforms.u_aspectRatio, canvas.offsetWidth / canvas.offsetHeight);
	gl.uniform2f(splatProgram.uniforms.u_point, x / canvas.offsetWidth, 1 - y / canvas.offsetHeight);
	gl.uniform3f(splatProgram.uniforms.u_color, config.FORCE * dx / canvas.offsetWidth, config.FORCE * -dy / canvas.offsetHeight, 0.0);
	gl.uniform1f(splatProgram.uniforms.u_radius, config.RADIUS / 100);
	blit(velocity.write);
	velocity.swap();

	gl.uniform1i(splatProgram.uniforms.u_target, dye.read.texture.attach(0));
	let color = generateColor();
	gl.uniform3f(splatProgram.uniforms.u_color, color.r, color.g, color.b);
	blit(dye.write);
	dye.swap();
}

function obstacle(target) {
	obstacleProgram.bind();
	gl.uniform1i(obstacleProgram.uniforms.u_source, target.read.texture.attach(0));
	blit(target.write);
	target.swap();
}

function step(dt) {
	curlProgram.bind();
	gl.uniform2f(curlProgram.uniforms.u_texelSize, velocity.texelSizeX, velocity.texelSizeY);
	gl.uniform1i(curlProgram.uniforms.u_velocity, velocity.read.texture.attach(0));
	blit(curl);

	vorticityProgram.bind();
	gl.uniform2f(vorticityProgram.uniforms.u_texelSize, velocity.texelSizeX, velocity.texelSizeY);
	gl.uniform1i(vorticityProgram.uniforms.u_velocity, velocity.read.texture.attach(0));
	gl.uniform1i(vorticityProgram.uniforms.u_curl, curl.texture.attach(1));
	gl.uniform1f(vorticityProgram.uniforms.u_coef, config.CURL);
	gl.uniform1f(vorticityProgram.uniforms.u_dt, dt);
	blit(velocity.write);
	velocity.swap();
	//obstacle(velocity);

	divergenceProgram.bind();
	gl.uniform2f(divergenceProgram.uniforms.u_texelSize, velocity.texelSizeX, velocity.texelSizeY);
	gl.uniform1i(divergenceProgram.uniforms.u_velocity, velocity.read.texture.attach(0));
	blit(divergence);

	clearProgram.bind();
	gl.uniform1i(clearProgram.uniforms.u_texture, pressure.read.texture.attach(0));
	gl.uniform4f(clearProgram.uniforms.u_color, config.PRESSURE, config.PRESSURE, config.PRESSURE, 1);
	blit(pressure.write);
	pressure.swap();

	pressureProgram.bind();
	gl.uniform2f(pressureProgram.uniforms.u_texelSize, velocity.texelSizeX, velocity.texelSizeY);
	gl.uniform1i(pressureProgram.uniforms.u_divergence, divergence.texture.attach(0));
	for (let i = 0; i < config.ITERATIONS ; i++) {
		gl.uniform1i(pressureProgram.uniforms.u_pressure, pressure.read.texture.attach(1));
		blit(pressure.write);
		pressure.swap();
	}

	gradienSubtractProgram.bind();
	gl.uniform2f(gradienSubtractProgram.uniforms.u_texelSize, velocity.texelSizeX, velocity.texelSizeY);
	gl.uniform1i(gradienSubtractProgram.uniforms.u_pressure, pressure.read.texture.attach(0));
	gl.uniform1i(gradienSubtractProgram.uniforms.u_velocity, velocity.read.texture.attach(1));
	blit(velocity.write);
	velocity.swap();
	//obstacle(velocity);

	advectionProgram.bind();
	gl.uniform2f(advectionProgram.uniforms.u_texelSize, velocity.texelSizeX, velocity.texelSizeY);
	gl.uniform2f(advectionProgram.uniforms.u_dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
	let velocityId = velocity.read.texture.attach(0);
	gl.uniform1i(advectionProgram.uniforms.u_velocity, velocityId);
	gl.uniform1i(advectionProgram.uniforms.u_source, velocityId);
	gl.uniform1f(advectionProgram.uniforms.u_dt, dt);
	gl.uniform1f(advectionProgram.uniforms.u_dissipation, config.VELOCITY_DISSIPATION);
	blit(velocity.write);
	velocity.swap();
	obstacle(velocity);

	advectionProgram.bind();
	gl.uniform1i(advectionProgram.uniforms.u_velocity, velocity.read.texture.attach(0));
	gl.uniform1i(advectionProgram.uniforms.u_source, dye.read.texture.attach(1));
	gl.uniform1f(advectionProgram.uniforms.u_dissipation, config.DYE_DISSIPATION);
	blit(dye.write);
	dye.swap();
}

function generateColor() {
	let c = HSVtoRGB(Math.random(), 1.1, 1.1);
	c.r *= config.DENSITY;
	c.g *= config.DENSITY;
	c.b *= config.DENSITY;
	return c;
}

function HSVtoRGB(h, s, v) {
	let r, g, b, i, f, p, q, t;
	i = Math.floor(h * 6);
	f = h * 6 - i;
	p = v * (1 - s);
	q = v * (1 - f * s);
	t = v * (1 - (1 - f) * s);
	switch (i % 6) {
		case 0: r = v, g = t, b = p; break;
		case 1: r = q, g = v, b = p; break;
		case 2: r = p, g = v, b = t; break;
		case 3: r = p, g = q, b = v; break;
		case 4: r = t, g = p, b = v; break;
		case 5: r = v, g = p, b = q; break;
	}
	return { r, g, b };
}