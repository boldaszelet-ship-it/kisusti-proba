// Kisüsti — globális shader-foltok a three.js beépített anyagaira (minden minőségszinten, mert olcsók):
//  1. magasság szerinti légköri köd: a völgy és a folyópart párásabb, a dombtető és a torony tisztább;
//     a köd távoli része mindig teljes (a látható világ széle így sosem rajzolódik ki az ég előtt).
//  2. halvány perem-fény (fresnel): az oldalra néző felületek a félgömbfény égszínét kapják a szélükön —
//     a low-poly tömegek így elválnak egymástól és az égtől; a felfelé néző felület (talaj, tető) nem kapja.
// A foltot az első rajzolás (a shaderek fordítása) előtt kell betölteni; ha később, a Grafika újrafordíttat.
import * as THREE from 'three';

const C = THREE.ShaderChunk;
if (!C.__kisusti) {
  C.__kisusti = true;
  C.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying float vFogH;\n#endif';
  // világ-y a nézeti térből: viewMatrix = [R|t] ortonormált, ezért világ = Rᵀ(v − t). Csúcsonként egy mat3-szorzás.
  C.fog_vertex = '#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n\tvFogH = ( transpose( mat3( viewMatrix ) ) * ( mvPosition.xyz - viewMatrix[3].xyz ) ).y;\n#endif';
  C.fog_pars_fragment = C.fog_pars_fragment.replace('varying float vFogDepth;', 'varying float vFogDepth;\n\tvarying float vFogH;');
  C.fog_fragment = `#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogLin = smoothstep( fogNear, fogFar, vFogDepth );
		// magassági tényező: 2 m felett e-alapú csökkenés (35 m-en ~0,3); a völgy aljának párája közelebb kezdődik
		float fogHk = exp( - max( vFogH - 2.0, 0.0 ) * 0.035 );
		float fogFactor = fogLin * mix( 0.6, 1.0, fogHk ) + ( 1.0 - exp( - vFogDepth * 0.0022 ) ) * fogHk * 0.15;
		fogFactor = max( clamp( fogFactor, 0.0, 1.0 ), smoothstep( fogFar * 0.82, fogFar * 1.12, vFogDepth ) );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
  C.opaque_fragment = `#if ( defined( LAMBERT ) || defined( STANDARD ) || defined( PHONG ) ) && NUM_HEMI_LIGHTS > 0
	{
		vec3 rimUp = ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz;
		float rimF = 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) );
		rimF = rimF * rimF * rimF * ( 1.0 - saturate( dot( normal, rimUp ) ) );
		outgoingLight += diffuseColor.rgb * hemisphereLights[ 0 ].skyColor * rimF * 0.32;
	}
#endif
` + C.opaque_fragment;
}

/** A foltok verziója (customProgramCacheKey-hez, ha kell). */
export const CHUNK_VERZIO = 'kisusti-1';
