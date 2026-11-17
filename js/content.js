// Built-in learning content: domains, characters and scenario templates.
// The model fills in the details of each scenario at run time, so the same template never plays out twice.
// New interests are added here (or later from the app) without touching the engine.

export const DOMAINS = [
  { id: 'daily', name: 'Everyday', fa: 'روزمره', active: true, base: 0.6 },
  { id: 'business', name: 'Business & trade', fa: 'تجارت و مذاکره', active: true, base: 0 },
  { id: 'sport', name: 'Sport & rehab', fa: 'ورزش و توانبخشی', active: true, base: 0 },
  { id: 'tech', name: 'Tech & AI', fa: 'تکنولوژی و هوش مصنوعی', active: true, base: 0 },
  { id: 'finance', name: 'Money & markets', fa: 'مالی و اقتصاد', active: false, base: 0 },
  { id: 'craft', name: 'Jewelry & design', fa: 'جواهر و طراحی', active: false, base: 0 },
];

export const CHARACTERS = {
  marco: {
    id: 'marco', name: 'Marco', domain: 'business', voice: 'Charon',
    role: 'olive-oil and food-ingredient supplier from Bari, Italy',
    persona: 'Warm, proud of his product, talks a little fast. Firm on price, but values long-term partners. Uses common trade terms (MOQ, lead time, FOB, CIF, samples).',
    line: 'Olive-oil supplier from Bari',
  },
  lena: {
    id: 'lena', name: 'Lena', domain: 'business', voice: 'Kore',
    role: 'sourcing manager for a pet-food and animal-feed company in Hamburg, Germany',
    persona: 'Direct, precise, a bit sceptical. Asks for numbers, certificates and delivery guarantees. Pushes back on vague answers.',
    line: 'Sourcing manager, Hamburg',
  },
  sam: {
    id: 'sam', name: 'Sam', domain: 'sport', voice: 'Puck',
    role: 'sports physiotherapist and strength coach in London',
    persona: 'Curious, evidence-minded, friendly. Likes to discuss studies, load management and return-to-play. Asks "what is your reasoning?"',
    line: 'Sports physio, London',
  },
  priya: {
    id: 'priya', name: 'Priya', domain: 'tech', voice: 'Aoede',
    role: 'software engineer at an AI start-up in Bangalore',
    persona: 'Fast thinker, practical, enjoys product ideas. Explains simply when asked. Challenges ideas that are too complex.',
    line: 'AI engineer, Bangalore',
  },
  maya: {
    id: 'maya', name: 'Maya', domain: 'daily', voice: 'Leda',
    role: 'friendly conversation partner from Toronto who loves travel, food and sport',
    persona: 'Relaxed, warm, funny. Shares small stories about her life and asks about yours. Never formal.',
    line: 'Friend from Toronto',
  },
};

// mode: 'roleplay' = a real situation; 'listen' = the character tells a short story or briefing first, then you discuss it.
export const SCENARIOS = [
  { id: 'b-price', domain: 'business', who: 'marco', mode: 'roleplay', title: 'Negotiate a price with Marco', goal: 'Get a better price or better terms for a first order without losing the relationship.' },
  { id: 'b-late', domain: 'business', who: 'marco', mode: 'roleplay', title: 'Your shipment is two weeks late', goal: 'Find out why, agree a new date and ask for compensation politely.' },
  { id: 'b-samples', domain: 'business', who: 'marco', mode: 'roleplay', title: 'Ask Marco for samples', goal: 'Ask about samples, MOQ, lead time and certificates.' },
  { id: 'b-buyer', domain: 'business', who: 'lena', mode: 'roleplay', title: 'First call with a buyer in Hamburg', goal: 'Present your product and answer her hard questions.' },
  { id: 'b-objection', domain: 'business', who: 'lena', mode: 'roleplay', title: 'Lena thinks you are too expensive', goal: 'Handle the price objection with value, not discounts.' },
  { id: 'b-market', domain: 'business', who: 'lena', mode: 'listen', title: 'Lena briefs you on the pet-food market', goal: 'Listen to her market update, then discuss what it means for you.' },
  { id: 's-acl', domain: 'sport', who: 'sam', mode: 'roleplay', title: 'Plan an ACL return-to-play with Sam', goal: 'Explain your rehab stages and criteria, and defend your choices.' },
  { id: 's-client', domain: 'sport', who: 'sam', mode: 'roleplay', title: 'First session with an online client', goal: 'Sam plays a new client. Ask the right questions and explain your plan.' },
  { id: 's-study', domain: 'sport', who: 'sam', mode: 'listen', title: 'Sam explains a new training study', goal: 'Listen to the study summary, then discuss if it changes your coaching.' },
  { id: 's-load', domain: 'sport', who: 'sam', mode: 'roleplay', title: 'Talk load management with Sam', goal: 'Discuss how you manage training load and fatigue for an athlete.' },
  { id: 't-idea', domain: 'tech', who: 'priya', mode: 'roleplay', title: 'Pitch your app idea to Priya', goal: 'Explain your idea simply and answer her technical questions.' },
  { id: 't-ai', domain: 'tech', who: 'priya', mode: 'roleplay', title: 'AI tools for your coaching business', goal: 'Discuss which AI tools could save you time, and the risks.' },
  { id: 't-news', domain: 'tech', who: 'priya', mode: 'listen', title: 'Priya on what changed in AI this month', goal: 'Listen to her short update, then share your opinion.' },
  { id: 'd-week', domain: 'daily', who: 'maya', mode: 'roleplay', title: 'Catch up with Maya about your week', goal: 'Talk naturally about what you did, what went well and what did not.' },
  { id: 'd-cafe', domain: 'daily', who: 'maya', mode: 'roleplay', title: 'Small talk at a conference coffee break', goal: 'Start a conversation with a stranger and keep it going.' },
  { id: 'd-travel', domain: 'daily', who: 'maya', mode: 'listen', title: 'Maya tells you about her last trip', goal: 'Listen to her story, ask follow-up questions and share yours.' },
  { id: 'd-plans', domain: 'daily', who: 'maya', mode: 'roleplay', title: 'Make weekend plans with Maya', goal: 'Suggest, agree and disagree politely.' },
];

// The tutor's level scale. B1 starts at 2.
export const LEVELS = [
  { n: 1, cefr: 'A2', speech: 'very short simple sentences, slow, common words only' },
  { n: 2, cefr: 'B1', speech: 'short clear sentences, everyday words, explain any special term in simple words' },
  { n: 3, cefr: 'B1+', speech: 'natural sentences, some idioms and domain terms, moderate pace' },
  { n: 4, cefr: 'B2', speech: 'natural native-like speech, domain vocabulary, phrasal verbs' },
  { n: 5, cefr: 'C1', speech: 'fast natural speech, nuance, idioms, challenge with complex questions' },
];

export const domainById = id => DOMAINS.find(d => d.id === id);
export const scenarioById = id => SCENARIOS.find(s => s.id === id);
