#version 330 core

#define FOV 1.

#define FAR_PLANE 100.
#define HIT_DIST 0.01

#define AMBIENT_PERCENT vec3(0.03)

#define AMBIENT 1.
#define DIFFUSE 1.
#define SPECULAR 2.
#define EMISSIVE 1.

#define SPECULAR_FALLOFF 40.

#define REFLECTIONS 1

#define AO_SAMPLES 5.

#define PI 3.141592
#define TAU 6.283184

out vec3 color;

uniform vec2 resolution;
uniform int time;
uniform float seed;

uniform vec3 cam;

vec2 uv;

struct Material {
	vec3 albedo;
	float roughness;
	float metallicity;
	float emissive;
} materials[] = Material[](
	Material(vec3(1), 1., 1., 0.),
	Material(vec3(0.6, 0, 0), 0., 0., 0.1),
	Material(vec3(1), 0., 1., 0.02) // Spinny thing
);

struct PointLight {
	vec3 pos;
	vec4 col;
	float radius;
} pointLights[] = PointLight[](
	PointLight(5.*vec3(sin(PI/3.), 2, cos(PI/3.)), vec4(0, 0, 1, 2), 100.),
	PointLight(5.*vec3(sin(2.*PI/3.), 2, cos(2.*PI/3.)), vec4(1, 0, 0, 2), 100.),
	PointLight(5.*vec3(0., 2, 1.), vec4(0, 1, 0, 2), 100.)
);

mat2 rotationMatrix(in float angle) {
	float s = sin(angle), c = cos(angle);
	return mat2(c, -s, s, c);
}
float SignedSphereDistance(in vec3 pos, in float r) { return length(pos) - r; }
float SignedBoxDistance(in vec3 worldDataP, in vec3 worldDataD) { return length(max(abs(worldDataP) - worldDataD, vec3(0))); }
float SignedRoundedBoxDistance(in vec3 worldDataP, in vec4 worldDataD) { return SignedBoxDistance(worldDataP, worldDataD.xyz - worldDataD.w) - worldDataD.w; }
float SignedTorusDistance(in vec3 p, in float r1, in float r2) { return length(vec2(length(p.xy)-r1,p.z))-r2; }
float[2] SceneDistance(in vec3 p) {
	float[2] data = float[](FAR_PLANE, 0);
	
	float ground = p.y+1.;
	if(ground < data[0]) {
		data[0] = ground;
		data[1] = 1.;
	}
	/*
	vec3 spherePos = p-vec3(0, 1, 0);
	float sphere = SignedSphereDistance(spherePos, 1.);
	if(sphere < data[0]) {
		data[0] = sphere;
		data[1] = 2.;
	}
	*/
	
	float osc = 0.5*sin(time*TAU/2500.);

	vec3 rboxPos = p-vec3(0, 1, 0);
	rboxPos.y += osc;
	float rbox = SignedSphereDistance(rboxPos, 0.2);
	if(rbox < data[0]) {
		data[0] = rbox;
		data[1] = 2.;
	}

	rboxPos.xy *= rotationMatrix(time/700.);
	rboxPos.zy *= rotationMatrix(time/400.);
	rbox = SignedTorusDistance(rboxPos, 0.5, 0.1);
	if(rbox < data[0]) {
		data[0] = rbox;
		data[1] = 3.;
	}
	
	return data;
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

void MarchScene(out float[2] hit, in vec3 ro, in vec3 rd) {
	float[2] data; // 0: distance to scene  1: materialID
	
	for(hit[0] = 0.; hit[0] <= FAR_PLANE;) {
		data = SceneDistance(ro + rd*hit[0]);

		if(data[0] < HIT_DIST) 
			break;

		hit[0] += data[0];
	}

	if(hit[0] > FAR_PLANE)
		hit[0] = -1;
	else
		hit[1] = data[1];
}

Material getMaterial(int index) {
	return materials[index-1];
}

void getTexelColor(inout vec3 albedo, in float[2] hit, in vec3 ro, in vec3 rd) {
	vec3 point = ro + rd*hit[0];
	switch(int(hit[1])) {
		case 0:
			rd.xz *= rotationMatrix(time/5000.);
			albedo = rd+0.5;
			break;
		case 1:
			point.xz *= rotationMatrix(PI/4.);
			albedo = getMaterial(1).albedo*(0.5+0.5*ceil(clamp(vec3(sin(1.5*point.x)+sin(1.5*point.z)), 0., 1.)));
			break;
		default:
			albedo = getMaterial(int(hit[1])).albedo;
			//albedo = SurfaceNormal(ro + rd*hit[0])+0.5;
			break;
	}
 }

float calculateAO(vec3 p, vec3 n){
    float r = 0.0, w = 1.0, d;
    
    for (float i=1.0; i<AO_SAMPLES+1.1; i++){
        d = i/AO_SAMPLES;
        r += w*(d - SceneDistance(p + n*d)[0]);
        w *= 0.5;
    }
    
    return 1.0-clamp(r,0.0,1.0);
}

vec3 GlobalIllumination(in float[2] hit, in vec3 ro, in vec3 rd) {
	vec3 point = ro + rd*hit[0];
	vec3 normal = SurfaceNormal(point);

	Material mat = getMaterial(int(hit[1]));

	float direct_light = 1.;
	vec3 ambient = AMBIENT_PERCENT, diffuse, specular;
	for(int i = 0; i < pointLights.length(); i++) {
		pointLights[i].pos.xz *= rotationMatrix(time*i*TAU/4000);
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

	// fresnel term
	float fre = pow( clamp(dot(normal, rd) + 1., .0, 1.), 1.);

	float occ = calculateAO(point, normal);

	vec3 global = mat.albedo*(AMBIENT*ambient + DIFFUSE*diffuse + SPECULAR*specular) + EMISSIVE*mat.emissive*mat.albedo;
	return global*direct_light*fre*occ;
}

float Hash21(in vec2 hash) {
  vec2 p = fract(hash*vec2(25.124, 85.124));
  p += dot(p, p + 234.124);
  return fract(p.x * p.y);
}
vec2 randomVec2(in float hash) {
	vec2 ret;
	ret.x = Hash21(vec2(hash, -hash));
	ret.y = Hash21(vec2(ret.x*ret.x, hash));
	return normalize(ret);
}
vec3 randomVec3(in vec3 point) {
  vec3 ret;
  ret.x = Hash21(vec2(point.x * point.y, point.z * point.y));
  ret.y = Hash21(vec2(point.x * point.z, point.y * point.x));
  ret.z = Hash21(vec2(point.y * point.z, point.z * point.y));
  return normalize(ret);
}

vec3 LookAt(in vec3 ro, in vec3 foc){
  vec3 to = normalize(foc - ro);
  vec3 r = cross(to, vec3(0, 1, 0));
  vec3 up = cross(r, to);
    
  return normalize((uv.x*r + uv.y*up)*FOV + to);
}
vec3 PixelColor() {
	vec3 pixelColor = vec3(0);
	//vec3 ro = vec3(4, 0.1, 0);
	vec3 foc = vec3(cam.x, cam.y, cam.z + 1.);

	float[2] hit; // 0: hit distance (-1 if no hit)  1: materialID

	vec3 off = 0.002*randomVec3(vec3(randomVec2(seed), seed));

	vec3 rd = LookAt(cam, foc);
	MarchScene(hit, cam, rd);
	getTexelColor(pixelColor, hit, cam, rd);

	if(hit[0] > 0.) pixelColor *= GlobalIllumination(hit, cam, rd);

	//pixelColor /= 3.;

	return pixelColor;
}

void main(){
	uv = (gl_FragCoord.xy - 0.5*resolution)/resolution.y;
	vec3 pixelColor = vec3(0);

	pixelColor += PixelColor();

	color = vec3(sqrt(clamp(pixelColor, 0., 1.)));
}