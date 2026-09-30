// The shop sign. Ported from the round-one mockup.
export function Logo({ className }: { className?: string }) {
  return (
    <svg className={`sd-logo ${className ?? ""}`} viewBox="0 0 900 470" role="img" aria-label="Supah Dupah, Famous Original Exchange and Pizzeria, est. 1994">
      <defs>
        <radialGradient id="sd-red" cx="50%" cy="42%" r="60%"><stop offset="0" stopColor="#E8283F"/><stop offset="1" stopColor="#9E0C22"/></radialGradient>
        <linearGradient id="sd-cheese" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF3A6"/><stop offset=".45" stopColor="#FFD21F"/><stop offset="1" stopColor="#F28A00"/></linearGradient>
        <path id="sd-top" d="M 42,232 A 408 204 0 0 1 858,232"/>
        <path id="sd-bot" d="M 30,232 A 420 212 0 0 0 870,232"/>
        <g id="sd-word" fontFamily="Lobster, 'Brush Script MT', cursive" textAnchor="middle">
          <text x="478" y="192" fontSize="122">Supah</text>
          <text x="492" y="298" fontSize="122">Dupah!</text>
        </g>
      </defs>
      {/* sign body */}
      <ellipse cx="450" cy="232" rx="442" ry="224" fill="#0B7A3B" stroke="#0A3B24" strokeWidth="6"/>
      <ellipse cx="450" cy="232" rx="374" ry="180" fill="none" stroke="#FFFFFF" strokeWidth="18"/>
      <ellipse cx="450" cy="232" rx="374" ry="180" fill="none" stroke="#C8102E" strokeWidth="18" strokeDasharray="17 17"/>
      <ellipse cx="450" cy="232" rx="362" ry="168" fill="url(#sd-red)" stroke="#FFFFFF" strokeWidth="4"/>
      <g fill="#FFFFFF" opacity=".12"><circle cx="300" cy="120" r="3"/><circle cx="620" cy="110" r="4"/><circle cx="700" cy="330" r="3"/><circle cx="260" cy="340" r="4"/><circle cx="560" cy="360" r="3"/></g>
      <text fontFamily="'Alfa Slab One', Georgia, serif" fontSize="27" fill="#FFFFFF" letterSpacing="5"><textPath href="#sd-top" startOffset="50%" textAnchor="middle">★ FAMOUS ORIGINAL ★</textPath></text>
      <text fontFamily="'Alfa Slab One', Georgia, serif" fontSize="21" fill="#F2B705" letterSpacing="4"><textPath href="#sd-bot" startOffset="50%" textAnchor="middle">EST. 1994 · WE DELIVER · CASH ONLY</textPath></text>
    
      {/* wordmark: dark extrusion, white outline, cheese fill */}
      <g fill="#5A0613"><use href="#sd-word" x="1" y="1"/><use href="#sd-word" x="2" y="2"/><use href="#sd-word" x="3" y="3"/><use href="#sd-word" x="4" y="4"/><use href="#sd-word" x="5" y="5"/><use href="#sd-word" x="6" y="6"/><use href="#sd-word" x="7" y="7"/><use href="#sd-word" x="8" y="8"/><use href="#sd-word" x="9" y="9"/></g>
      <use href="#sd-word" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="14" strokeLinejoin="round"/>
      <use href="#sd-word" fill="url(#sd-cheese)" stroke="#7A0515" strokeWidth="3" strokeLinejoin="round"/>
    
      {/* ribbon */}
      <g>
        <path d="M 222,338 L 180,338 L 198,362 L 180,386 L 246,386 Z" fill="#0A3B24"/>
        <path d="M 738,338 L 780,338 L 762,362 L 780,386 L 714,386 Z" fill="#0A3B24"/>
        <path d="M 224,326 Q 480,346 736,326 L 736,372 Q 480,392 224,372 Z" fill="#0B7A3B" stroke="#FFFFFF" strokeWidth="3"/>
        <text x="480" y="362" textAnchor="middle" fontFamily="'Alfa Slab One', Georgia, serif" fontSize="19" fill="#FFFFFF" letterSpacing="1.5">EXCHANGE · PIZZERIA · TRUCK FUTURES</text>
      </g>
    
      {/* chef */}
      <g className="sd-chef">
        <circle cx="190" cy="100" r="32" fill="#FFF" stroke="#1D1A17" strokeWidth="4"/>
        <circle cx="150" cy="118" r="30" fill="#FFF" stroke="#1D1A17" strokeWidth="4"/>
        <circle cx="230" cy="118" r="30" fill="#FFF" stroke="#1D1A17" strokeWidth="4"/>
        <rect x="132" y="120" width="116" height="38" rx="4" fill="#FFF" stroke="#1D1A17" strokeWidth="4"/>
        <circle cx="190" cy="232" r="82" fill="#F6C8A0" stroke="#1D1A17" strokeWidth="5"/>
        <ellipse cx="132" cy="258" rx="16" ry="10" fill="#F08F86" opacity=".7"/>
        <ellipse cx="250" cy="258" rx="16" ry="10" fill="#F08F86" opacity=".7"/>
        <path d="M 132,196 Q 158,178 180,196" stroke="#1D1A17" strokeWidth="10" fill="none" strokeLinecap="round"/>
        <path d="M 202,190 Q 226,172 250,188" stroke="#1D1A17" strokeWidth="10" fill="none" strokeLinecap="round"/>
        <path d="M 140,216 Q 157,226 174,216" stroke="#1D1A17" strokeWidth="6" fill="none" strokeLinecap="round"/>
        <ellipse cx="226" cy="216" rx="14" ry="16" fill="#FFF" stroke="#1D1A17" strokeWidth="4"/>
        <circle cx="230" cy="219" r="6" fill="#1D1A17"/>
        <path d="M 176,300 Q 190,322 210,300 Z" fill="#8E0B20" stroke="#1D1A17" strokeWidth="4"/>
        <g id="sd-stache" fill="#1D1A17">
          <path d="M 190,272 C 176,300 132,304 104,284 C 84,270 88,242 110,246 C 100,256 106,272 124,274 C 150,278 168,262 190,266 Z"/>
        </g>
        <use href="#sd-stache" transform="translate(380,0) scale(-1,1)"/>
        <circle cx="190" cy="254" r="21" fill="#E48C6E" stroke="#1D1A17" strokeWidth="4"/>
        <g transform="translate(58,34) rotate(-10)">
          <path d="M 0,0 L 118,0 Q 124,0 124,6 L 124,44 Q 124,50 118,50 L 40,50 L 22,70 L 26,50 L 6,50 Q 0,50 0,44 Z" fill="#FFFFFF" stroke="#1D1A17" strokeWidth="4"/>
          <text x="62" y="36" textAnchor="middle" fontFamily="'Alfa Slab One', Georgia, serif" fontSize="26" fill="#C8102E">AYYY!</text>
        </g>
      </g>
    
      {/* slice */}
      <g className="sd-slice" transform="translate(772,268) rotate(26) scale(.82)">
        <path d="M -70,-110 Q 0,-140 70,-110 L 0,110 Z" fill="#FFCF3A" stroke="#1D1A17" strokeWidth="5" strokeLinejoin="round"/>
        <path d="M -38,20 Q -34,50 -26,42 Q -22,30 -18,48 Q -14,66 -6,50" fill="#FFCF3A" stroke="#1D1A17" strokeWidth="4"/>
        <path d="M -78,-112 Q 0,-150 78,-112 Q 80,-94 70,-96 Q 0,-124 -70,-96 Q -80,-94 -78,-112 Z" fill="#C98A3E" stroke="#1D1A17" strokeWidth="5" strokeLinejoin="round"/>
        <circle cx="-22" cy="-66" r="15" fill="#C8102E" stroke="#1D1A17" strokeWidth="3"/>
        <circle cx="26" cy="-48" r="14" fill="#C8102E" stroke="#1D1A17" strokeWidth="3"/>
        <circle cx="-2" cy="-4" r="12" fill="#C8102E" stroke="#1D1A17" strokeWidth="3"/>
        <circle cx="10" cy="42" r="8" fill="#C8102E" stroke="#1D1A17" strokeWidth="3"/>
        <g className="sd-steam" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity=".85">
          <path d="M -30,-150 q -12,-16 0,-32 q 12,-16 0,-32"/>
          <path d="M 0,-156 q -12,-16 0,-32 q 12,-16 0,-32"/>
          <path d="M 30,-150 q -12,-16 0,-32 q 12,-16 0,-32"/>
        </g>
      </g>
    
      {/* sticker */}
      <g className="sd-sticker" transform="translate(800,78)">
        <polygon points="0.0,-74.0 10.1,-57.1 25.3,-69.5 29.0,-50.2 47.6,-56.7 44.4,-37.3 64.1,-37.0 54.5,-19.8 72.9,-12.8 58.0,0.0 72.9,12.8 54.5,19.8 64.1,37.0 44.4,37.3 47.6,56.7 29.0,50.2 25.3,69.5 10.1,57.1 0.0,74.0 -10.1,57.1 -25.3,69.5 -29.0,50.2 -47.6,56.7 -44.4,37.3 -64.1,37.0 -54.5,19.8 -72.9,12.8 -58.0,0.0 -72.9,-12.8 -54.5,-19.8 -64.1,-37.0 -44.4,-37.3 -47.6,-56.7 -29.0,-50.2 -25.3,-69.5 -10.1,-57.1" fill="#F2B705" stroke="#1D1A17" strokeWidth="4" strokeLinejoin="round"/>
        <text textAnchor="middle" fontFamily="'Alfa Slab One', Georgia, serif" fill="#C8102E" transform="rotate(12)">
          <tspan x="0" y="-14" fontSize="17">NOW</tspan><tspan x="0" y="6" fontSize="17">WIT'</tspan><tspan x="0" y="28" fontSize="17">FUTURES!</tspan>
        </text>
      </g>
    </svg>
  );
}
