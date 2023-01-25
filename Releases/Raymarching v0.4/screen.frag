#version 330 core

#define FOV 1.

#define BACKGROUND(dir) dir*0.5+0.5

#define FAR 300.
#define NEAR 0.2414
#define HIT_DIST 0.01

#define AMBIENT_PERCENT vec3(0.03)

#define AMBIENT 1.
#define DIFFUSE 1.
#define SPECULAR 1.
#define EMISSIVE 1.

#define SPECULAR_FALLOFF 40.

#define REFLECTIONS 1

#define FRE 0

#define AO 1
#define AO_SAMPLES 5.

#define PI 3.141592
#define TAU 6.283184

out vec3 color;

uniform vec2 res;
uniform int time;
uniform float seed;

uniform vec3 cam;
uniform vec3 look;

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
	PointLight(5.*vec3(sin(PI/3.), 2, cos(PI/3.)), vec4(0, 0, 1, 2), 120.),
	PointLight(5.*vec3(sin(2.*PI/3.), 2, cos(2.*PI/3.)), vec4(1, 0, 0, 2), 120.),
	PointLight(5.*vec3(0., 2, 1.), vec4(0, 1, 0, 2), 120.)
);

mat2 rotationMatrix(in float angle) {
	float s = sin(angle), c = cos(angle);
	return mat2(c, -s, s, c);
}
float sdfSphere(in vec3 pos, in float r) { return length(pos) - r; }
float sdfBox( vec3 p, vec3 s ) { 
	p = abs(p)-s;
	return length(max(p, 0.))+min(max(p.x, max(p.y, p.z)), 0.);
}
float sdfRoundedBox(in vec3 worldDataP, in vec4 worldDataD) { return sdfBox(worldDataP, worldDataD.xyz - worldDataD.w) - worldDataD.w; }
float sdfTorus(in vec3 p, in float r1, in float r2) { return length(vec2(length(p.xy)-r1,p.z))-r2; }
float[2] sdf(in vec3 p) {
	float[2] data = float[](FAR, 0);
	
	// SCENE BUILD
	
	// GROUND

		float ground = abs(p.y+10.)-0.015;
		if(ground < data[0]) {
			data[0] = ground;
			data[1] = 1.;
		}
	
	// SPINNER
		// BALL
		vec3 spinnerPos = p;
		spinnerPos.y += 0.1*sin(time*TAU*0.0004);
		float spinner = sdfSphere(spinnerPos, 1.);
		if(spinner < data[0]) {
			data[0] = spinner;
			data[1] = 2.;
		}
		// RINGS
		spinnerPos.xy *= rotationMatrix(time*0.0014286);
		spinnerPos.zy *= rotationMatrix(time*0.0025);
		float ring = sdfTorus(spinnerPos, 1.5, 0.1);
		if(ring < data[0]) {
			data[0] = ring;
			data[1] = 3.;
		}
		spinnerPos.xy *= rotationMatrix(-6.*sin(time*0.0005263));
		spinnerPos.zy *= rotationMatrix(time*0.001);
		ring = sdfTorus(spinnerPos, 2., 0.1);
		if(ring < data[0]) {
			data[0] = ring;
			data[1] = 3.;
		}
	
	// END SCENE

	// performance gets mega bad when you intersect objects without a near plane
	return float[](max(data[0], NEAR-length(p-cam)), data[1]); // NEAR PLANE
	// return data; // NO NEAR PLANE
}

vec3 SurfaceNormal(in vec3 point) {
	vec2 delta = vec2(0.0001, 0);
	vec3 gradient = vec3(
		sdf(point - delta.xyy)[0],
	    sdf(point - delta.yxy)[0],
	    sdf(point - delta.yyx)[0]
	);
  return normalize(sdf(point)[0] - gradient);
}

void MarchScene(out float[2] hit, in vec3 ro, in vec3 rd) {
	float[2] data; // 0: distance to scene  1: materialID
	
	for(hit[0] = 0.; hit[0] <= FAR;) {
		data = sdf(ro + rd*hit[0]);

		if(abs(data[0]) < HIT_DIST) 
			break;

		hit[0] += data[0];
	}

	if(hit[0] > FAR)
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
        r += w*(d - sdf(p + n*d)[0]);
        w *= 0.5;
    }
    
    return 1.0-clamp(r,0.0,1.0);
}

vec3 GlobalIllumination(in float[2] hit, in vec3 ro, in vec3 rd) {
	vec3 point = ro + rd*hit[0];
	vec3 normal = SurfaceNormal(point);

	Material mat = getMaterial(int(hit[1]));

	vec3 ambient = AMBIENT_PERCENT, diffuse, specular;
	for(int i = 0; i < pointLights.length(); i++) {
		vec3 lightVector = pointLights[i].pos - point;
		float lightDistance = length(lightVector);

		if(lightDistance > pointLights[i].radius + length(pointLights[i].pos - ro)) continue;

		lightVector = normalize(lightVector);

		float attenuation = 1./lightDistance;

		ambient += pointLights[i].col.rgb*attenuation	;
		diffuse += pointLights[i].col.rgb*dot(normal, lightVector)*pointLights[i].col.a*attenuation;

		vec3 halfway = normalize(normalize(ro - point) + lightVector);
		float specularIntensity = pow(clamp(dot(normal, halfway), 0., 1.), max(mat.metallicity*SPECULAR_FALLOFF, 1.));
		specular += pointLights[i].col.rgb*pointLights[i].col.a*specularIntensity*attenuation;
	}
	specular = clamp(specular, 0., 1.);

	float occ = 1.;
	if(AO == 1) 
		occ = calculateAO(point, normal);

	vec3 global = AMBIENT*ambient + DIFFUSE*diffuse + SPECULAR*specular + EMISSIVE*mat.emissive;
	return mat.albedo*global*occ;
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

vec3 LookAt(vec2 uv){
  // a cross b = (aybz-azby, axbz-azbx, axby-aybx)
  vec3 r = normalize(cross(vec3(0, 1, 0), look));
  vec3 up = cross(r, look);
    
  return normalize((uv.x*r - uv.y*up)*FOV + look);
}
vec3 PixelColor(vec2 uv) {
	vec3 pixelColor;

	vec3 rd = LookAt(uv);

	float[2] hit; // 0: hit distance (-1 if no hit)  1: materialID
	MarchScene(hit, cam, rd);

	vec2 bdir = rd.xz*rotationMatrix(time*0.0005);
	vec3 bgCol = BACKGROUND(vec3(bdir.x, rd.y, bdir.y));

	if(hit[0] > 0.) {
		getTexelColor(pixelColor, hit, cam, rd);
		pixelColor *= GlobalIllumination(hit, cam, rd);
	} else return bgCol;

	pixelColor = mix(pixelColor, bgCol, smoothstep(10., FAR, hit[0])); // backgroud fog

	return pixelColor;
}

void mainImage(out vec3 pixelColor, in vec2 fragCoord) {
	vec2 uv = (fragCoord - 0.5*res)/res.y;

	// LIGHT POSITIONS
	for(int i = 0; i < pointLights.length(); i++)
		pointLights[i].pos.xz *= rotationMatrix(time*i*TAU*0.0004);

	pixelColor += PixelColor(uv);
}

void main(){
	vec3 pixelColor;

	mainImage(pixelColor, gl_FragCoord.xy);

	color = sqrt(clamp(pixelColor, 0., 1.)); // Light gamma correction
}