#version 330 core

#define FOV 1.

#define FAR_PLANE 100.
#define HIT_DIST 0.01

#define AMBIENT_PERCENT vec3(0.01)

#define AMBIENT 1.
#define DIFFUSE 1.
#define SPECULAR 2.
#define EMISSIVE 1.

#define SPECULAR_FALLOFF 40.

#define PI 3.141592
#define TAU 6.283184

out vec3 color;

uniform vec2 resolution;
uniform int time;

vec2 uv;

struct Material {
	vec3 albedo;
	float roughness;
	float metallicity;
	float emissive;
} materials[] = Material[](
	Material(vec3(1, 0.6, 0.2), 1., 0., 0.),
	Material(vec3(0.7), 0., 1., 0.),
	Material(vec3(0.6, 0, 0.7), 0., 0., 0.)
);

struct PointLight {
	vec3 pos;
	vec4 col;
	float radius;
} pointLights[] = PointLight[](
	PointLight(5.*vec3(-2, 2, 0), vec4(0, 0, 1, 1 ), 100.),
	PointLight(5.*vec3(2, 2, 2), vec4(1, 0, 0, 1), 100.),
	PointLight(5.*vec3(1, 2, -2), vec4(0, 1, 0, 1), 100.)
);

float SignedSphereDistance(vec3 position, vec4 sphere) { return length(position - sphere.xyz) - sphere.w; }

float SignedBoxDistance(vec3 position, vec3 worldDataP, vec3 worldDataD) { return length(max(abs(position - worldDataP) - worldDataD, vec3(0))); }

float SignedRoundedBoxDistance(vec3 position, vec3 worldDataP, vec4 worldDataD) { return SignedBoxDistance(position, worldDataP, worldDataD.xyz - worldDataD.w) - worldDataD.w; }

float[2] SceneDistance(in vec3 p) {
	float[2] data = float[](FAR_PLANE, 0);

	float ground = p.y;
	if(ground < data[0]) {
		data[0] = ground;
		data[1] = 1.;
	}
	
	float box = SignedBoxDistance(p, vec3(-2, 1.5, 0), vec3(0.2, 0.5, 0.7));
	if(box < data[0]) {
		data[0] = box;
		data[1] = 2.;
	}

	float rbox = SignedRoundedBoxDistance(p, vec3(0, 1.5, 0), vec4(0.2, 1, 0.7, 0.9));
	if(rbox < data[0]) {
		data[0] = rbox;
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

Material getMaterial(int index) {
	return materials[index-1];
}

void getTexelColor(inout vec3 albedo, in float[2] hit, in vec3 ro, in vec3 rd) {
	switch(int(hit[1])) {
		case 0:
			albedo = rd+0.5;
			break;
		case 1:
			vec3 point = ro + rd*hit[0];
			albedo = getMaterial(1).albedo*(0.5+0.5*ceil(clamp(vec3(sin(2.*point.x)+sin(2.*point.z)), 0., 1.)));
			break;
		default:
			albedo = getMaterial(int(hit[1])).albedo;
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

	Material mat = getMaterial(int(hit[1]));

	vec3 ambient = AMBIENT_PERCENT, diffuse, specular;
	for(int i = 0; i < pointLights.length(); i++) {
		vec3 lightVector = pointLights[i].pos - point;
		float lightDistance = length(lightVector);

		if(lightDistance > pointLights[i].radius) continue;

		lightVector = normalize(lightVector);

		float attenuation = 1./lightDistance;

		ambient += pointLights[i].col.rgb*attenuation	;
		diffuse += pointLights[i].col.rgb*dot(normal, lightVector)*pointLights[i].col.a*attenuation;

		vec3 halfway = normalize(normalize(ro - point) + lightVector);
		float specularIntensity = pow(clamp(dot(normal, halfway), 0., 1.), max(mat.metallicity*SPECULAR_FALLOFF, 1.));
		specular += pointLights[i].col.rgb*pointLights[i].col.a*specularIntensity*attenuation;
	}
	specular = clamp(specular, 0., 1.);

	vec3 global = mat.albedo*(AMBIENT*ambient + DIFFUSE*diffuse + SPECULAR*specular) + EMISSIVE*mat.emissive*mat.albedo;
	return global;
}

vec3 PixelColor() {
	vec3 pixelColor = vec3(0);
	vec3 ro = 2.*vec3(0, 1, 0);
	vec3 foc = vec3(0, 1, 0);

	float t = time*TAU/5000., r = 5.;

	ro.x += r*cos(t);
	ro.z += r*sin(t);

	float[2] hit; // 0: hit distance (-1 if no hit)  1: materialID

	vec3 rd = LookAt(ro, foc);
	MarchScene(hit, ro, rd);
	getTexelColor(pixelColor, hit, ro, rd);
	if(hit[0] > 0.) pixelColor *= GlobalIllumination(hit, ro, rd);
	return pixelColor/2.;
}

void main(){
	uv = (gl_FragCoord.xy - 0.5*resolution)/resolution.y;
	vec3 pixelColor = vec3(0);

	pixelColor += PixelColor();

	color = vec3(sqrt(clamp(pixelColor, 0., 1.)));
}