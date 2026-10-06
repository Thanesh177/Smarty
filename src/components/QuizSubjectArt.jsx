const dots = (points) => points.map(([cx, cy], index) => <circle key={index} cx={cx} cy={cy} r="3" className="quiz-art-node" />);

// Small subject-specific diagrams, drawn locally rather than loading decorative images.
export default function QuizSubjectArt({ subject }) {
  const illustrations = {
    'trading-markets': <><path d="M25 104h112M30 104V24M45 75V40M72 88V52M99 67V27M126 54V18" /><path d="M39 48h12v20H39zM66 62h12v18H66zM93 36h12v23H93zM120 28h12v17h-12z" className="quiz-art-accent" /></>,
    psychology: <><circle cx="60" cy="63" r="29" /><circle cx="98" cy="63" r="29" className="quiz-art-accent" /><path d="M45 63h68M79 35v57M67 54l12 9-12 9M91 54l-12 9 12 9" /></>,
    neuroscience: <><path d="M72 61 48 34M72 61l30-35M72 61 41 90M72 61l42 31M72 61 25 61M72 61l59-4M48 34l-15-12M48 34l-24 7M102 26l4-14M102 26l28-3M41 90l-9 19M114 92l17 12" />{dots([[72,61],[48,34],[102,26],[41,90],[114,92],[25,61],[131,57]])}</>,
    'game-theory': <><path d="M32 28h96v78H32zM80 28v78M32 67h96" /><path d="m45 41 19 13M60 41l4 13-13 1M114 41 95 54M99 41l-4 13 13 1M45 93l19-13M60 93l4-13-13-1M114 93 95 80M99 93l-4-13 13-1" className="quiz-art-accent" /></>,
    news: <><path d="M28 29h91M28 40h52M28 75h91M28 86h70" /><path d="M28 53h33v11H28zM75 53h44M75 64h33" className="quiz-art-accent" /></>,
    technology: <><path d="M28 59h30l20-29h40M58 59l20 29h40M78 30v58M118 30v58" />{dots([[28,59],[58,59],[78,30],[118,30],[78,88],[118,88]])}</>,
    engineering: <><path d="m78 22 38 21v43L78 108 40 86V43zM40 43l38 22 38-22M78 65v43" /><path d="m78 22 0 43M40 86l38-21 38 21" className="quiz-art-accent" /></>,
    'science-mathematics': <><path d="M23 97h111M34 106V20" /><path d="M35 78c15 0 15-42 30-42s15 56 30 56 15-42 30-42" className="quiz-art-accent" />{dots([[65,36],[95,92]])}</>,
    'life-sciences': <><path d="M56 18c59 24-20 69 39 93M95 18c-59 24 20 69-39 93" className="quiz-art-accent" />{[28,42,57,72,87,101].map((y,index)=><path key={y} d={`M${index % 2 ? 62 : 55} ${y}h${index % 2 ? 27 : 41}`} />)}</>,
    'earth-space': <><circle cx="79" cy="63" r="32" /><path d="M21 91c-9-13 14-37 52-52s74-17 79-4-19 37-56 52-69 16-75 4Z" className="quiz-art-accent" /><path d="M67 34c-15 16-15 42 0 58M88 33c15 17 15 43 0 60" /></>,
    'mind-health': <><path d="M77 63 48 36M77 63l33-34M77 63 43 92M77 63l40 32M77 63 26 62M77 63l48-4M48 36l-9-16M48 36l-22 1M110 29l-1-14M110 29l24-4M43 92l-4 19M43 92 22 89M117 95l20 5" />{dots([[77,63],[48,36],[110,29],[43,92],[117,95],[26,62],[125,59]])}</>,
    'money-business': <><path d="M26 99h106M35 88V70h22v18M68 88V51h22v37M101 88V29h22v59" /><path d="m31 50 38-23 28 8 27-21M113 14h11v11" className="quiz-art-accent" /></>,
    'food-agriculture': <><path d="M44 98c-21-51 2-66 63-74 11 49-7 77-63 74Z" /><path d="m37 112 60-77M59 83l-8-26M71 68l25 2M84 52l-4-16" className="quiz-art-accent" /></>,
    history: <><path d="M25 92h112M34 86V54h94v32M44 86V55M64 86V55M85 86V55M107 86V55M29 47l53-26 51 26z" /><path d="M28 102h108M77 29v12" className="quiz-art-accent" /></>,
    'society-ideas': <><circle cx="63" cy="62" r="31" /><circle cx="99" cy="62" r="31" className="quiz-art-accent" /><path d="M32 101h97M54 111h53" /></>,
    'arts-design': <><path d="M30 26h86v73H30zM44 39h86v73H44z" /><path d="m52 89 27-35 33 44M72 74l18-12 18 22" className="quiz-art-accent" /><circle cx="104" cy="52" r="6" /></>,
    community: <><path d="M43 42 112 42 79 94ZM43 42l36-24 33 24M79 94l-40 12M79 94l39 12" />{dots([[43,42],[112,42],[79,94],[79,18],[39,106],[118,106]])}</>,
  };
  return <svg className="quiz-subject-art" viewBox="0 0 160 130" fill="none" aria-hidden="true" focusable="false">
    <g stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">{illustrations[subject] || illustrations.technology}</g>
  </svg>;
}
