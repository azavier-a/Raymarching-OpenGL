#version 330 core

#define FOV 1.1

#define STEPS 300
#define SHA_STEPS 200

#define FAR 250.
#define NEAR 0.2414
#define HIT 0.01

#define AMBIENT_PERCENT vec3(0.005)

#define AMBIENT 1.
#define DIFFUSE 1.
#define SPECULAR 1.
#define EMISSIVE 1.

#define SPECULAR_FALLOFF 40.

#define BOUNCES 10 

#define FRE 0

#define AO 1
#define AO_SAMPLES 10.

#define SHADOWS 1

#define PI 3.141592
#define TAU 6.283184

#define sat(a) clamp(a, 0., 1.)
#define material(index) materials[index-1]

out vec3 col;

uniform vec2 res;
uniform int time;
uniform float seed;

uniform vec3 cam;
uniform vec3 look;

struct Material { // IF ROUGH == 0 || IREF <= 1 it's reflective. IF ROUGH < 1 && IREF > 1 ITS REFRACTIVE
    vec4 albedo;
    float rough;
    float metal;
    float iref;
} materials[] = Material[](
    Material(vec4(0.7,0.7,0.7, 0), 1., 3., 0.),
    Material(vec4(0.6,0.01,0.01, 0), 1., 0.01, 0.),
    Material(vec4(1,1,1, 0.02), 1., 1., 0.), // Spinny thing
    Material(vec4(0,0,0, 0), 0., 0.01, 0.),
    Material(vec4(0,0,0, 0), 0., 1., 0.),
    Material(vec4(0,0,0, 0), 0.8, 1., 1.6)
);

struct Ray {
  vec3 ro, rd;

  int bounces;
  float[3] hit;
  vec3 hitp, hitn;
  Material mat;
};

struct PointLight {
    vec3 pos;
    vec4 col;
    float radius;
} lights[] = PointLight[](
    PointLight(5.*vec3(sin(PI/3.), 2, cos(PI/3.)), vec4(0, 0, 1, 1), 160.),
    PointLight(5.*vec3(sin(2.*PI/3.), 2, cos(2.*PI/3.)), vec4(1, 0, 0, 1), 160.),
    PointLight(5.*vec3(0., 2, 1.), vec4(0, 1, 0, 1), 160.)
);
float recipLights = 1./lights.length();

mat2 rotationMatrix(in float angle) {
    float s = sin(angle), c = cos(angle);
    return mat2(c, -s, s, c);
}

vec3 bgcol(in vec3 rd) {
  //rd.xz *= rotationMatrix(time*0.0005);
  //return 0.5*rd + 0.5;

  vec3 skyc = vec3(0.15,0.51,0.91);
  vec3 horizon = vec3(0.63,0.78,0.91);
  vec3 ground = vec3(0.27,0.34,0.40);
  ground = mix(ground, vec3(0.07,0.14,0.20), smoothstep(0.1, 1., -rd.y));

  vec3 sky = mix(horizon, skyc, smoothstep(0.05, 0.7, rd.y+sat(sin(rd.y*rd.x*rd.z+time*0.001))));
  
  vec3 bg = mix(ground, sky, smoothstep(0., 0.02, rd.y));
  bg *= mix(vec3(1), 1.4*horizon, smoothstep(0.1, 0., abs(rd.y)));
  
  vec3 sunp = normalize(vec3(0.4,0.5,-1));
  
  bg += mix(vec3(0), 2.*horizon, smoothstep(0.995, 1., dot(rd, sunp)));
  
  return bg;
}

float sdfSphere(in vec3 pos, in float r) { return length(pos) - r; }
float sdfBox( vec3 p, vec3 s ) { 
    p = abs(p)-s;
    return length(max(p, 0.))+min(max(p.x, max(p.y, p.z)), 0.);
}
float sdfTorus(in vec3 p, in float r1, in float r2) { return length(vec2(length(p.xy)-r1,p.z))-r2; }
float sdfRhombicIcos(in vec3 p, in float r) {
  float c = cos(PI/5.), s = sqrt(0.75-c*c);
  vec3 n = vec3(-0.5, -c, s);

  p = abs(p);
  p -= 2.*min(0., dot(p, n))*n;

  p.xy = abs(p.xy);
  p -= 2.*min(0., dot(p, n))*n;

  p.xy = abs(p.xy);
  p -= 2.*min(0., dot(p, n))*n;

  return p.z-1.;
}
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
    float ball = sdfSphere(spinnerPos, 1.);
    if(ball < data[0]) {
      data[0] = ball;
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
    
  // MIRRORS
    vec3 mirpos = p - vec3(0, 9, 0);
        
    mirpos.xz = abs(mirpos.xz)-vec2(5);

    mirpos.xz *= rotationMatrix(PI/4.);
    mirpos.zy *= rotationMatrix(-PI/6.);

    mirpos.y += 0.5*sin(mirpos.x*mirpos.z+time*0.003);

    float mir = sdfBox(mirpos, vec3(1.8+0.1*sin(TAU*mirpos.y*mirpos.z+time*0.005), 2, 0.3))-0.2;
    if(mir < data[0]) {
      data[0] = mir*0.5;
      data[1] = 4.;
    }
  
  // MORPHING BOX
    vec3 mpos = p - vec3(10, -6, 0);
    float box = sdfBox(mpos, vec3(1.8))-0.2;
    float sphere = sdfSphere(mpos, 2.);

    float morph = mix(box, sphere, smoothstep(-.2, 1., sin(time*0.002)));
    if(morph < data[0]) {
      data[0] = morph*0.9;
      data[1] = 6.;
    }

  // RHOMBIC ICOSAHEDRON
    vec3 icosp = p - vec3(0, 10, 0);
    icosp.xz *= rotationMatrix(time*0.001);
    float icos = sdfRhombicIcos(icosp, 1.);
    if(icos < data[0]) {
      data[0] = icos;
      data[1] = 6.;
    }
  // END SCENE

  // performance gets mega bad when you intersect objects without a near plane. Also the near plane is fun and quirky.
  return float[](max(data[0], (NEAR-length(p-cam)*0.9)), data[1]); // NEAR PLANE
  // return data; // NO NEAR PLANE
}

vec3 normal(in vec3 point) {
    vec2 delta = vec2(0.01, 0);
    vec3 gradient = vec3(
        sdf(point - delta.xyy)[0],
        sdf(point - delta.yxy)[0],
        sdf(point - delta.yyx)[0]
    );
  return normalize(sdf(point)[0] - gradient);
}
vec3 normal(in vec3 point, in float d) {
    vec2 delta = vec2(0.01, 0);
    vec3 gradient = vec3(
        sdf(point - delta.xyy)[0],
        sdf(point - delta.yxy)[0],
        sdf(point - delta.yyx)[0]
    );
  return normalize(d - gradient);
}

float[3] trace(in vec3 ro, in vec3 rd, in int steps, in float side) {
    float dist = 0.;
    
    float[2] data;
    for(int i = 0; i < steps; i++) {
        data = sdf(ro + rd*dist);
        data[0] *= side;

        if(abs(data[0]) < HIT || dist > FAR) 
            break;

        dist += data[0];
    }
    return float[3](dist, data[1], data[0]); // 0: distance to scene along ray  1: materialID
}

vec3 getTexel(in int matID, in Material mat, in vec3 p) {
  switch(matID) {
    //case :
    //  return normal(p)*0.5+0.5;
    case 0:
      return vec3(0);
    case 1:
      p.xz *= rotationMatrix(PI/4.);
      return material(1).albedo.rgb*(0.5+0.5*ceil(clamp(vec3(sin(1.5*p.x)+sin(1.5*p.z)), 0., 1.)));
    default:
      return material(matID).albedo.rgb;
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

vec3 lighting(in Ray ray, in vec3 texel) {
  vec3 ambient = AMBIENT_PERCENT, diffuse, specular;
  for(int i = 0; i < lights.length(); i++) {
    vec3 lightVector = lights[i].pos - ray.hitp;
    float lightDistance = length(lightVector);

    if(lightDistance > lights[i].radius + length(lights[i].pos - ray.ro)) continue;

    lightVector = normalize(lightVector);

    float attenuation = 1./(lightDistance*0.5);

    ambient += lights[i].col.rgb*attenuation;
    diffuse += lights[i].col.rgb*sat(dot(ray.hitn, lightVector))*lights[i].col.a*attenuation;

    vec3 halfway = normalize(normalize(ray.ro - ray.hitp) + lightVector);
    float specularIntensity = pow(sat(dot(ray.hitn, halfway)), max(ray.mat.metal*SPECULAR_FALLOFF, 1.));
    specular += lights[i].col.rgb*lights[i].col.a*specularIntensity*attenuation;
  }
  //specular = sat(specular);

  float occ = 1.;
  if(AO == 1) 
    occ = calculateAO(ray.hitp, ray.hitn);

  vec3 global = occ*(AMBIENT*ambient + DIFFUSE*diffuse + SPECULAR*specular) + EMISSIVE*ray.mat.albedo.a;
  return texel*global;
}

float Hash11(float hash) {
    return (fract(sin((hash)*114.514)*1919.810));
}
float randomseed;
float rand() {
    randomseed++;
    return Hash11(randomseed);
}
float Hash21(in vec2 hash) {
  vec2 p = fract(hash*vec2(25.124, 85.124));
  p += dot(p, p + 234.124);
  return fract(p.x * p.y);
}
vec2 randomVec2(in float hash) {
    vec2 ret;
    ret.x = Hash11(hash);
    ret.y = Hash11(ret.x);
    return normalize(ret);
}
vec3 randomVec3(in float hash) {
  vec3 ret;
  ret.x = Hash11(hash);
  ret.y = Hash11(ret.x);
  ret.z = Hash11(ret.y);
  return normalize(ret);
}
vec3 randomVec3(in vec3 point) {
  vec3 ret;
  ret.x = Hash11(point.x * point.z);
  ret.y = Hash11(ret.x * point.y);
  ret.z = Hash11(ret.y * point.x);
  return normalize(ret);
}

void refractt(inout Ray ray) {
  ray.hitn = normal(ray.hitp);
  
  ray.ro = ray.hitp - ray.hitn*HIT*4.;
  vec3 rdent = refract(ray.rd, ray.hitn, 1./ray.mat.iref);
  
  float dI = trace(ray.ro, rdent, STEPS, -1.)[0];
  
  ray.ro += rdent*dI;
  ray.hitn = -normal(ray.ro);
  
  ray.rd = refract(rdent, ray.hitn, ray.mat.iref);
  if(ray.rd.x*ray.rd.x + ray.rd.y*ray.rd.y + ray.rd.z*ray.rd.z == 0.) {
    ray.rd = reflect(rdent, ray.hitn);
    dI = trace(ray.ro+ray.hitn*HIT*4., ray.rd, STEPS, -1.)[0];
    ray.ro += ray.rd*dI;
    ray.hitn = -normal(ray.ro);
  }
  ray.ro -= ray.hitn*HIT*4.;
}

vec3 bounce(inout Ray ray) {
  vec3 bg = bgcol(ray.rd);
  
  ray.hit = trace(ray.ro, ray.rd, STEPS, 1.);
  if(ray.hit[0] > FAR)
    return bg;

  ray.mat = material(int(ray.hit[1]));

  ray.hitp = ray.ro + ray.rd*ray.hit[0];
  ray.hitn = normal(ray.hitp, ray.hit[2]);

  vec3 texCol = getTexel(int(ray.hit[1]), ray.mat, ray.hitp);

  if(ray.mat.rough == 1.)
    texCol *= lighting(ray, texCol);

    //GAMMA CORRECTION
    //texCol = sqrt(sat(texCol));
  if(ray.mat.rough > 0. && ray.mat.iref > 1.)
    refractt(ray);
  
  if(ray.mat.rough == 0.) {
    ray.ro = ray.hitp;
    ray.ro += ray.hitn*HIT;

    ray.rd = reflect(ray.rd, ray.hitn);
  }

  //BG FOG
  texCol = mix(texCol, bg, smoothstep(0., FAR*FAR, ray.hit[0]*ray.hit[0]));
  return texCol;
}

void surfcol(inout vec3 pixelColor, in Ray ray) {
  for(ray.bounces; ray.hit[0] < FAR && ray.bounces < BOUNCES && ray.mat.rough < 1.; ray.bounces++)
    pixelColor += bounce(ray);

  if(ray.bounces > 1)
    pixelColor /= float(ray.bounces-1);
}

vec3 LookAt(vec2 uv){
  // a cross b = (aybz-azby, axbz-azbx, axby-aybx)
  vec3 r = normalize(cross(vec3(0, 1, 0), look));
  vec3 up = cross(r, look);
    
  return normalize((uv.x*r - uv.y*up)*FOV + look);
}
vec3 PixelColor(vec2 uv) {
  vec3 pixelColor;
  
  Ray ray;
  ray.ro = cam;
  ray.rd = LookAt(uv);

  surfcol(pixelColor, ray);

  return pixelColor;
}

void mainImage(out vec3 pixelColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5*res)/res.y;

  // SPINNING LIGHTS
  for(int i = 0; i < lights.length(); i++)
    lights[i].pos.xz *= rotationMatrix(time*i*TAU*0.0004);
  
  pixelColor += PixelColor(uv);
}

void main(){
  vec3 pixelColor;

  mainImage(pixelColor, gl_FragCoord.xy);

  col = pixelColor;
}