#version 330 core

#define FOV 1.

#define FAR_PLANE 100.
#define HIT_DIST 0.01

#define AMBIENT_PERCENT vec3(0.01)

#define AMBIENT 1.
#define DIFFUSE 1.

#define PI 3.141592
#define TAU 6.283184

out vec3 color;

uniform vec2 resolution;
uniform int time;

vec2 uv;

struct PointLight {
	vec3 pos, col;
	float radius, intensity;
} pointLights[] = PointLight[](
	PointLight(vec3(-2, 2, 0), vec3(1), 1., 1.),
	PointLight(vec3(2, 2, 2), vec3(1, 0, 0), 1., 1.)
);
float[2] SceneDistance(in vec3 p) {
	float[2] data = float[](FAR_PLANE, 0);

	float ground = p.y;
	if(ground < data[0]) {
		data[0] = ground;
		data[1] = 1.;
	}

	float sphere = length(vec3(p.x, p.y - 1., p.z)) - 1.;
	if(sphere < data[0]) {
		data[0] = sphere;
		data[1] = 2.;
	}

	return data;
}

vec3 LookAt(in vec3 ro, in vec3 foc){
  vec3 to = normalize(foc - ro);
  vec3 r = cross(to, vec3(0, 1, 0));
  vec3 up = cross(r, to);
    
  return normalize((uv.x*r + uv.y*up)*FOV + to);
}

void MarchScene(inout float[2] hit, in vec3 ro, in vec3 rd) {
	float[2] data; // 0: distance to scene  1: materialID
	
	for(hit[0] = 0.; hit[0] <= FAR_PLANE;) {
		data = SceneDistance(ro + rd*hit[0]);

		if(data[0] < HIT_DIST) 
			break;

		hit[0] += data[0];
	}

	if(hit[0] > FAR_PLANE) {
		hit[0] = -1;
	} else {
		hit[1] = data[1];
	}
}

void getAlbedo(inout vec3 pixelColor, in float[2] hit, in vec3 ro, in vec3 rd) {
	switch(int(hit[1])) {
		case 0:
			pixelColor = rd+0.5;
			break;
		case 1:
			vec3 point = ro + rd*hit[0];
			pixelColor = 0.5+0.5*ceil(clamp(vec3(sin(2.*point.x)+sin(2.*point.z)), 0., 1.));
			break;
		case 2:
			pixelColor = vec3(0.7);
			break;
	}
 }

vec3 SurfaceNormal(in vec3 point) {
	vec2 delta = vec2(0.0001, 0);
	vec3 gradient = vec3(
		SceneDistance(point - delta.xyy)[0],
	    SceneDistance(point - delta.yxy)[0],
	    SceneDistance(point - delta.yyx)[0]
	);
  return normalize(SceneDistance(point)[0] - gradient);
}

vec3 GlobalIllumination(in float[2] hit, in vec3 ro, in vec3 rd) {
	vec3 point = ro + rd*hit[0];
	vec3 normal = SurfaceNormal(point);

	vec3 ambient = AMBIENT_PERCENT, diffuse, albedo;
	getAlbedo(albedo, hit, ro, rd);
	for(int i = 0; i < pointLights.length(); i++) {
		vec3 lightVector = pointLights[i].pos - point;
		float lightDistance = length(lightVector);
		lightVector = normalize(lightVector);

		float attenuation = 1./lightDistance;
		//ambient += lightColors[i].rgb*attenuation*1.;
		ambient += pointLights[i].col.rgb*attenuation	;
		diffuse += albedo*pointLights[i].col.rgb*dot(normal, lightVector)*pointLights[i].intensity*attenuation;
	}
	ambient *= albedo;

	vec3 global = AMBIENT*ambient + DIFFUSE*diffuse;
	return global;
}

vec3 PixelColor() {
	vec3 pixelColor = vec3(0);
	vec3 ro = vec3(0, 1, 0);
	vec3 foc = vec3(0, 1, 0);

	float t = time*TAU/5000., r = 5.;

	ro.x += r*cos(t);
	ro.z += r*sin(t);

	float[2] hit; // 0: hit distance (-1 if no hit)  1: materialID

	vec3 rd = LookAt(ro, foc);
	MarchScene(hit, ro, rd);
	getAlbedo(pixelColor, hit, ro, rd);

	if(hit[0] > 0.) pixelColor *= GlobalIllumination(hit, ro, rd);
	return pixelColor;
}

void main(){
  uv = (gl_FragCoord.xy - 0.5*resolution)/resolution.y;
  vec3 pixelColor = vec3(0);

  pixelColor += PixelColor();

  color = vec3(sqrt(clamp(pixelColor, 0., 1.)));
}