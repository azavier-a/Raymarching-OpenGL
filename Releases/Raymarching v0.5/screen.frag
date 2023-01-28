#version 330 core

#define FOV 1.1

#define AA 2

#define FAR 250.
#define NEAR 0.2414
#define HIT 0.01

#define AMBIENT_PERCENT vec3(0.005)

#define AMBIENT 1.
#define DIFFUSE 1.
#define SPECULAR 1.
#define EMISSIVE 1.

#define SPECULAR_FALLOFF 40.

#define BOUNCES 5   

#define FRE 0

#define AO 1
#define AO_SAMPLES 10.

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

struct Material {
    vec3 albedo;
    float rough;
    float metal;
    float light;
} materials[] = Material[](
    Material(vec3(1), 1., 1., 0.),
    Material(vec3(0.6, 0.01, 0.01), 1., 0., 0.1),
    Material(vec3(1), 1., 1., 0.02), // Spinny thing
    Material(vec3(0), 0., 5., 0.) 
);

struct PointLight {
    vec3 pos;
    vec4 col;
    float radius;
} lights[] = PointLight[](
    PointLight(5.*vec3(sin(PI/3.), 2, cos(PI/3.)), vec4(0, 0, 1, 2), 160.),
    PointLight(5.*vec3(sin(2.*PI/3.), 2, cos(2.*PI/3.)), vec4(1, 0, 0, 2), 160.),
    PointLight(5.*vec3(0., 2, 1.), vec4(0, 1, 0, 2), 160.)
);

mat2 rotationMatrix(in float angle) {
    float s = sin(angle), c = cos(angle);
    return mat2(c, -s, s, c);
}

vec3 bgcol(in vec3 rd) {
  rd.xz *= rotationMatrix(time*0.0005);
  return 0.5*rd + 0.5;
}

float sdfSphere(in vec3 pos, in float r) { return length(pos) - r; }
float sdfBox( vec3 p, vec3 s ) { 
    p = abs(p)-s;
    return length(max(p, 0.))+min(max(p.x, max(p.y, p.z)), 0.);
}
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
    
    // BOXES
      vec3 boxpos = p - vec3(-9, 9, 0);

      boxpos.xz *= rotationMatrix(PI/2.);
      boxpos.zy *= rotationMatrix(PI/6.);

      boxpos.y += 0.5*cos(time*0.003);

      float box = sdfBox(boxpos, vec3(1.8+0.1*sin(TAU*boxpos.y+time*0.005), 2, 0.3))-0.2;
      if(box < data[0]) {
        data[0] = box*0.7;
        data[1] = 4.;
      }

      boxpos = p - vec3(9, 9, 0);

      boxpos.xz *= rotationMatrix(-PI/2.);
      boxpos.zy *= rotationMatrix(PI/6.);

      boxpos.y += 0.5*sin(time*0.003);

      box = sdfBox(boxpos, vec3(1.8+0.1*sin(TAU*boxpos.y+time*0.005), 2, 0.3))-0.2;
      if(box < data[0]) {
        data[0] = box*0.7;
        data[1] = 4.;
      }

      boxpos = p - vec3(0, 9, -9);

      boxpos.zy *= rotationMatrix(PI/6.);

      boxpos.y -= 0.5*cos(time*0.003);

      box = sdfBox(boxpos, vec3(1.8+0.1*sin(TAU*boxpos.y+time*0.005), 2, 0.3))-0.2;
      if(box < data[0]) {
        data[0] = box*0.7;
        data[1] = 4.;
      }

      boxpos = p - vec3(0, 9, 9);

      boxpos.zy *= rotationMatrix(-PI/6.);

      boxpos.y -= 0.5*sin(time*0.003);

      box = sdfBox(boxpos, vec3(1.8+0.1*sin(TAU*boxpos.y+time*0.005), 2, 0.3))-0.2;
      if(box < data[0]) {
        data[0] = box*0.7;
        data[1] = 4.;
      }

    // END SCENE

    // performance gets mega bad when you intersect objects without a near plane
    return float[](max(data[0], (NEAR-length(p-cam)*0.9)), data[1]); // NEAR PLANE
    // return data; // NO NEAR PLANE
}

vec3 normal(in vec3 point) {
    vec2 delta = vec2(0.001, 0);
    vec3 gradient = vec3(
        sdf(point - delta.xyy)[0],
        sdf(point - delta.yxy)[0],
        sdf(point - delta.yyx)[0]
    );
  return normalize(sdf(point)[0] - gradient);
}
vec3 normal(in vec3 point, in float d) {
    vec2 delta = vec2(0.001, 0);
    vec3 gradient = vec3(
        sdf(point - delta.xyy)[0],
        sdf(point - delta.yxy)[0],
        sdf(point - delta.yyx)[0]
    );
  return normalize(d - gradient);
}

float[3] trace(in vec3 ro, in vec3 rd) {
    float dist = 0.;
    
    float[2] data;
    for(dist = 0.; dist < FAR;) {
        data = sdf(ro + rd*dist);

        if(abs(data[0]) < HIT) 
            break;

        dist += data[0];
    }
    return float[3](dist, data[1], data[0]); // 0: distance to scene along ray  1: materialID
}

vec3 getTexel(in int matID, in Material mat, in vec3 p) {
    switch(matID) {
        case 0:
            return vec3(0);
        case 1:
            p.xz *= rotationMatrix(PI/4.);
            return material(1).albedo*(0.5+0.5*ceil(clamp(vec3(sin(1.5*p.x)+sin(1.5*p.z)), 0., 1.)));
        default:
            return material(matID).albedo;
            //return normal(p)*0.5+0.5;
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

vec3 lighting(in Material mat, in vec3 texel, in vec3 ro, in vec3 p, in vec3 n) {
    vec3 ambient = AMBIENT_PERCENT, diffuse, specular;
    for(int i = 0; i < lights.length(); i++) {
        vec3 lightVector = lights[i].pos - p;
        float lightDistance = length(lightVector);

        if(lightDistance > lights[i].radius + length(lights[i].pos - ro)) continue;

        lightVector = normalize(lightVector);

        float attenuation = 1./(lightDistance*0.5);

        ambient += lights[i].col.rgb*attenuation;
        diffuse += lights[i].col.rgb*sat(dot(n, lightVector))*lights[i].col.a*attenuation;

        vec3 halfway = normalize(normalize(ro - p) + lightVector);
        float specularIntensity = pow(sat(dot(n, halfway)), max(mat.metal*SPECULAR_FALLOFF, 1.));
        specular += lights[i].col.rgb*lights[i].col.a*specularIntensity*attenuation;
    }
    specular = sat(specular);

    float occ = 1.;
    if(AO == 1) 
        occ = calculateAO(p, n);

    vec3 global = AMBIENT*ambient + DIFFUSE*diffuse + SPECULAR*specular + EMISSIVE*mat.light;
    return texel*global*occ;
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

vec3 bounce(out Material mat, inout float[3] hit, inout vec3 ro, inout vec3 rd) {
  vec3 bg = bgcol(rd);
  
  hit = trace(ro, rd);
  if(hit[0] > FAR)
    return bg;

  mat = material(int(hit[1]));

  vec3 hitp = ro + rd*hit[0];
  vec3 n = normal(hitp, hit[2]);

  vec3 texCol = getTexel(int(hit[1]), mat, hitp);

  if(mat.rough == 1.) {
    texCol *= lighting(mat, texCol, ro, hitp, n);

    //GAMMA CORRECTION
    //texCol = sqrt(sat(texCol));
    //BG FOG
    texCol = mix(texCol, bg, smoothstep(0., FAR*FAR, hit[0]*hit[0]));
  }

  ro = hitp;
  ro += n*HIT;

  rd = reflect(rd, n);
  return texCol;
}

void surfcol(inout vec3 pixelColor, in vec3 ro, in vec3 rd) {
  float[3] hit;
  int bounces;

  for(bounces; hit[0] < FAR && bounces < BOUNCES;) {
    Material mat;
    pixelColor += bounce(mat, hit, ro, rd);

    bounces++;
    if(mat.rough == 1.)
      break;
  }
  
  if(bounces > 1)
    pixelColor /= float(bounces-1);
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

  surfcol(pixelColor, cam, rd);

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