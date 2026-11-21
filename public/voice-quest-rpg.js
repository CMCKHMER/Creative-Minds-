/* ==========================================================================
   Srok Speak · Modern Cambodia Voice Adventure RPG (Talk to me Adventure Mode)
   60-FPS Canvas Living World · Expressive Animated Characters · Day/Night &
   Weather · Dynamic Multi-Turn English Conversations · Live Speech & Word
   Pronunciation Coach · 8 Real-World Quests + Hidden Quest + Mini-Game ·
   RPG Progression, Customization, Pets, SRS Coach & CMC Leaderboard Sync.
   ========================================================================== */
(() => {
  'use strict';

  const STORAGE_KEY = 'cmc_srok_speak_rpg_v1';
  const FIRESTORE_URL =
    'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents/drill_attempts';
  const TOKEN_URL =
    'https://securetoken.googleapis.com/v1/token?key=AIzaSyDNUq0ru99XKh08D887Xk63h36MPOlXWwc';

  /* ── Titles & Progression Curve ── */
  const TITLES = [
    { level: 1, title: 'Beginner Speaker' },
    { level: 2, title: 'Village Greeter' },
    { level: 3, title: 'Market Explorer' },
    { level: 4, title: 'Confident Speaker' },
    { level: 5, title: 'Village Helper' },
    { level: 7, title: 'Temple Storyteller' },
    { level: 9, title: 'Festival Ambassador' },
    { level: 12, title: 'Conversation Master' },
  ];

  const OUTFITS = [
    { id: 'student', name: 'Modern Student', body: '#38bdf8', trim: '#f8fafc', pants: '#1e3a5f', desc: 'Crisp Cambodian school shirt & neat collar' },
    { id: 'krama', name: 'Krama Explorer', body: '#14b8a6', trim: '#ef4444', pants: '#334155', desc: 'Checkered red-and-cream krama scarf' },
    { id: 'festival', name: 'Silk Festival', body: '#f59e0b', trim: '#10b981', pants: '#78350f', desc: 'Golden Khmer silk celebration jacket' },
    { id: 'sunset', name: 'Mekong Adventurer', body: '#a855f7', trim: '#fde047', pants: '#1e293b', desc: 'Iridescent explorer tunic & satchel' },
  ];
  const SKINS = ['#f3c6a5', '#e4ac84', '#cf936b', '#b67a54'];
  const HAIRS = ['#1b1717', '#3b2417', '#5c3720', '#1e293b'];
  const ACCESSORIES = [
    { id: 'none', name: 'None' },
    { id: 'cap', name: 'Sun Cap' },
    { id: 'lotus', name: 'Lotus Clip' },
    { id: 'glasses', name: 'Scholar Glasses' },
  ];
  const PETS = [
    { id: 'kitten', name: 'Mekong Kitten', icon: '🐱', color: '#fbbf24', accent: '#fff7ed', cost: 0, desc: 'Purrs happily whenever you nail a phrase!' },
    { id: 'puppy', name: 'Golden Puppy', icon: '🐶', color: '#d97706', accent: '#fef3c7', cost: 60, desc: 'Does joyful flips on speaking streaks!' },
    { id: 'bird', name: 'Lotus Songbird', icon: '🐦', color: '#22d3ee', accent: '#f472b6', cost: 110, desc: 'Flutters beside you with gentle chimes.' },
    { id: 'elephant', name: 'Baby Elephant', icon: '🐘', color: '#94a3b8', accent: '#f472b6', cost: 180, desc: 'Royal little friend from Angkor forests.' },
  ];

  /* ── 8 Modern Cambodian Explorable Locations ── */
  const ZONES = {
    village: {
      id: 'village', name: 'Phum Lotus Village', khmer: 'ភូមិឈូក', icon: '🏡',
      subtitle: 'Stilt houses, lotus ponds & warm morning greetings',
      ground: '#5ca96c', groundAlt: '#539e62', path: '#d7be92', water: '#2ca6b8',
      musicScale: [261.6, 293.7, 329.6, 392.0, 440.0, 523.3],
      spawn: { x: 460, y: 390 },
      gates: [
        { to: 'school', label: 'To Champa School', x: 1080, y: 260, dir: 'east' },
        { to: 'market', label: 'To Phsar Market', x: 580, y: 690, dir: 'south' },
      ],
      props: [
        { type: 'stiltHouse', x: 160, y: 120, w: 185, h: 125, roof: '#b45309', name: 'Dara’s Stilt House' },
        { type: 'stiltHouse', x: 760, y: 110, w: 175, h: 120, roof: '#9a3412', name: 'Community Pavilion' },
        { type: 'pond', x: 140, y: 455, w: 290, h: 175 },
        { type: 'bridge', x: 410, y: 505, w: 110, h: 66 },
        { type: 'palm', x: 110, y: 290 }, { type: 'palm', x: 375, y: 155 },
        { type: 'palm', x: 985, y: 170 }, { type: 'palm', x: 925, y: 545 },
        { type: 'bench', x: 580, y: 280 },
        { type: 'lantern', x: 460, y: 320 }, { type: 'lantern', x: 700, y: 320 },
        { type: 'board', x: 640, y: 210, title: 'Village Welcome Sign', msg: 'Welcome to Phum Lotus! Say "Hello" to Dara, explore the market, and speak English with every friend you meet.' },
        { type: 'collectible', id: 'c_vil_1', x: 245, y: 420, label: 'Pink Lotus Petal', icon: '🪷' },
      ],
    },
    school: {
      id: 'school', name: 'Champa Community School', khmer: 'សាលាបុប្ផាចំប៉ា', icon: '🏫',
      subtitle: 'Bright classroom pavilion, library garden & student projects',
      ground: '#63b273', groundAlt: '#58a668', path: '#dfd3bc', water: '#38bdf8',
      musicScale: [293.7, 329.6, 392.0, 440.0, 523.3, 587.3],
      spawn: { x: 160, y: 360 },
      gates: [
        { to: 'village', label: 'To Phum Lotus', x: 65, y: 360, dir: 'west' },
        { to: 'temple', label: 'To Wat Santipheap', x: 1080, y: 360, dir: 'east' },
      ],
      props: [
        { type: 'school', x: 350, y: 95, w: 410, h: 145, name: 'Champa Classroom Hall' },
        { type: 'flagpole', x: 555, y: 295 },
        { type: 'garden', x: 240, y: 485, w: 220, h: 115 },
        { type: 'garden', x: 690, y: 485, w: 220, h: 115 },
        { type: 'bench', x: 470, y: 440 }, { type: 'bench', x: 640, y: 440 },
        { type: 'palm', x: 150, y: 150 }, { type: 'palm', x: 960, y: 160 }, { type: 'palm', x: 980, y: 580 },
        { type: 'lantern', x: 360, y: 280 }, { type: 'lantern', x: 750, y: 280 },
        { type: 'board', x: 825, y: 245, title: 'English Club Board', msg: 'Tip of the day: Ask "Why?" or "What do you like?" to keep every English conversation flowing naturally!' },
        { type: 'collectible', id: 'c_sch_1', x: 880, y: 515, label: 'Golden Star Bookmark', icon: '⭐' },
      ],
    },
    market: {
      id: 'market', name: 'Phsar Thmei Market', khmer: 'ផ្សារធំថ្មី', icon: '🥭',
      subtitle: 'Golden Art-Deco stalls, sweet mangoes, iced coffee & krama scarves',
      ground: '#c7aa7c', groundAlt: '#bc9f72', path: '#e7d8be', water: '#38bdf8',
      musicScale: [261.6, 329.6, 392.0, 440.0, 523.3, 659.3],
      spawn: { x: 560, y: 130 },
      gates: [
        { to: 'village', label: 'To Phum Lotus', x: 580, y: 55, dir: 'north' },
        { to: 'transit', label: 'To Tuk-Tuk Hub', x: 1080, y: 390, dir: 'east' },
        { to: 'park', label: 'To Mekong Park', x: 70, y: 390, dir: 'west' },
      ],
      props: [
        { type: 'marketDome', x: 430, y: 265, w: 260, h: 140, name: 'Golden Market Dome' },
        { type: 'stall', x: 165, y: 170, w: 170, h: 95, canopy: '#ef4444', label: 'Mango & Dragonfruit' },
        { type: 'stall', x: 785, y: 170, w: 170, h: 95, canopy: '#0ea5e9', label: 'Kafé Iced Coffee' },
        { type: 'stall', x: 170, y: 500, w: 170, h: 95, canopy: '#f59e0b', label: 'Krama Silk Booth' },
        { type: 'stall', x: 780, y: 500, w: 170, h: 95, canopy: '#10b981', label: 'Fresh Coconut Cart' },
        { type: 'lantern', x: 380, y: 230 }, { type: 'lantern', x: 740, y: 230 },
        { type: 'lantern', x: 380, y: 495 }, { type: 'lantern', x: 740, y: 495 },
        { type: 'minigame', x: 255, y: 320, title: 'Market Quick-Order Rush', desc: 'Speak 4 fast customer orders for bonus coins & XP!' },
        { type: 'collectible', id: 'c_mkt_1', x: 925, y: 465, label: 'Sweet Golden Mango', icon: '🥭' },
      ],
    },
    temple: {
      id: 'temple', name: 'Wat Santipheap Gardens', khmer: 'វត្តសន្តិភាព', icon: '🛕',
      subtitle: 'Golden lotus stupa, Bodhi shade & peaceful heritage stories',
      ground: '#6aa876', groundAlt: '#619f6d', path: '#e8d7b7', water: '#2eb5c4',
      musicScale: [220.0, 261.6, 293.7, 329.6, 392.0, 440.0],
      spawn: { x: 160, y: 380 },
      gates: [
        { to: 'school', label: 'To Champa School', x: 65, y: 380, dir: 'west' },
        { to: 'festival', label: 'To Festival Plaza', x: 580, y: 690, dir: 'south' },
        { to: 'secret', label: 'Misty Bamboo Path', x: 1065, y: 145, dir: 'east', secret: true },
      ],
      props: [
        { type: 'stupa', x: 550, y: 185, name: 'Golden Lotus Stupa' },
        { type: 'pond', x: 720, y: 430, w: 260, h: 165 },
        { type: 'palm', x: 240, y: 140 }, { type: 'palm', x: 880, y: 150 },
        { type: 'palm', x: 230, y: 560 }, { type: 'palm', x: 1010, y: 270 },
        { type: 'bench', x: 350, y: 440 },
        { type: 'lantern', x: 435, y: 260 }, { type: 'lantern', x: 665, y: 260 },
        { type: 'board', x: 355, y: 255, title: 'Heritage Plaque', msg: 'Rumour says a hidden Bamboo Path in the northeast corner leads to the Golden Lotus Sanctuary for curious explorers...' },
        { type: 'collectible', id: 'c_tmp_1', x: 850, y: 390, label: 'Golden Lotus Petal', icon: '🪷' },
      ],
    },
    park: {
      id: 'park', name: 'Mekong Riverside Park', khmer: 'សួនមាត់ទន្លេមេគង្គ', icon: '🌿',
      subtitle: 'Banyan shade, riverboats, badminton & community kindness',
      ground: '#55ad6f', groundAlt: '#4da366', path: '#dfd5c3', water: '#1d8fb5',
      musicScale: [261.6, 293.7, 349.2, 392.0, 440.0, 523.3],
      spawn: { x: 960, y: 380 },
      gates: [
        { to: 'market', label: 'To Phsar Market', x: 1080, y: 380, dir: 'east' },
        { to: 'festival', label: 'To Festival Plaza', x: 580, y: 690, dir: 'south' },
      ],
      props: [
        { type: 'river', x: 0, y: 0, w: 1160, h: 170 },
        { type: 'garden', x: 230, y: 260, w: 220, h: 105 },
        { type: 'garden', x: 680, y: 260, w: 220, h: 105 },
        { type: 'bench', x: 340, y: 455 }, { type: 'bench', x: 740, y: 455 },
        { type: 'palm', x: 140, y: 250 }, { type: 'palm', x: 540, y: 250 }, { type: 'palm', x: 960, y: 240 },
        { type: 'lantern', x: 220, y: 200 }, { type: 'lantern', x: 560, y: 200 }, { type: 'lantern', x: 900, y: 200 },
        { type: 'collectible', id: 'c_prk_1', x: 155, y: 530, label: 'Mekong Postcard', icon: '💌' },
      ],
    },
    festival: {
      id: 'festival', name: 'Bon Om Touk Festival Plaza', khmer: 'ទីលានបុណ្យអុំទូក', icon: '🏮',
      subtitle: 'Glowing lanterns, dragon boats, music & joyful wishes',
      ground: '#4a5568', groundAlt: '#434d60', path: '#c9b497', water: '#1b6d96',
      musicScale: [293.7, 329.6, 392.0, 440.0, 523.3, 659.3],
      spawn: { x: 580, y: 140 },
      gates: [
        { to: 'park', label: 'To Mekong Park', x: 120, y: 120, dir: 'north' },
        { to: 'temple', label: 'To Wat Santipheap', x: 580, y: 55, dir: 'north' },
        { to: 'transit', label: 'To Tuk-Tuk Hub', x: 1080, y: 360, dir: 'east' },
      ],
      props: [
        { type: 'stage', x: 375, y: 220, w: 390, h: 140, name: 'Water Festival Drum Stage' },
        { type: 'river', x: 0, y: 555, w: 1160, h: 195 },
        { type: 'lantern', x: 250, y: 240 }, { type: 'lantern', x: 885, y: 240 },
        { type: 'lantern', x: 250, y: 455 }, { type: 'lantern', x: 575, y: 455 }, { type: 'lantern', x: 885, y: 455 },
        { type: 'wishLantern', id: 'wl_1', x: 320, y: 495, label: 'Festival Wish Lantern #1' },
        { type: 'wishLantern', id: 'wl_2', x: 575, y: 495, label: 'Festival Wish Lantern #2' },
        { type: 'wishLantern', id: 'wl_3', x: 830, y: 495, label: 'Festival Wish Lantern #3' },
        { type: 'collectible', id: 'c_fst_1', x: 160, y: 445, label: 'Golden Lotus Petal', icon: '🪷' },
      ],
    },
    transit: {
      id: 'transit', name: 'Tuk-Tuk & Express Hub', khmer: 'ស្ថានីយ៍ទុកទុក', icon: '🛺',
      subtitle: 'Colorful tuk-tuks, friendly drivers & asking directions',
      ground: '#7f8c9a', groundAlt: '#758290', path: '#cbd5e1', water: '#38bdf8',
      musicScale: [261.6, 293.7, 329.6, 392.0, 493.9, 523.3],
      spawn: { x: 160, y: 380 },
      gates: [
        { to: 'market', label: 'To Phsar Market', x: 65, y: 380, dir: 'west' },
        { to: 'festival', label: 'To Festival Plaza', x: 580, y: 690, dir: 'south' },
      ],
      props: [
        { type: 'kiosk', x: 430, y: 110, w: 300, h: 115, name: 'Phnom Penh Express Kiosk' },
        { type: 'tuktuk', x: 245, y: 315, color: '#06b6d4' },
        { type: 'tuktuk', x: 810, y: 315, color: '#f59e0b' },
        { type: 'tuktuk', x: 245, y: 525, color: '#ec4899' },
        { type: 'palm', x: 130, y: 150 }, { type: 'palm', x: 1000, y: 155 },
        { type: 'lantern', x: 400, y: 265 }, { type: 'lantern', x: 760, y: 265 },
        { type: 'board', x: 825, y: 220, title: 'City Route Map', msg: 'Go straight for the Market · Turn left for Mekong Park · Turn right for Wat Santipheap Temple!' },
        { type: 'collectible', id: 'c_trn_1', x: 965, y: 525, label: 'Lucky Tuk-Tuk Bell', icon: '🔔' },
      ],
    },
    secret: {
      id: 'secret', name: 'Hidden Lotus Sanctuary', khmer: 'ឧទ្យានឈូកមាសសម្ងាត់', icon: '✨',
      subtitle: 'Misty bamboo waterfall & the Secret Storyteller challenge',
      ground: '#3d8b74', groundAlt: '#357f6a', path: '#c8d6bd', water: '#22d3ee',
      musicScale: [220.0, 261.6, 329.6, 392.0, 440.0, 523.3],
      spawn: { x: 170, y: 390 },
      gates: [
        { to: 'temple', label: 'Back to Wat Santipheap', x: 65, y: 390, dir: 'west' },
      ],
      props: [
        { type: 'pond', x: 370, y: 200, w: 420, h: 260, glowing: true },
        { type: 'palm', x: 210, y: 160 }, { type: 'palm', x: 930, y: 160 },
        { type: 'palm', x: 220, y: 580 }, { type: 'palm', x: 920, y: 575 },
        { type: 'lantern', x: 330, y: 220 }, { type: 'lantern', x: 830, y: 220 },
        { type: 'lantern', x: 330, y: 470 }, { type: 'lantern', x: 830, y: 470 },
        { type: 'collectible', id: 'c_sec_1', x: 580, y: 550, label: 'Crown Lotus Gem', icon: '💎' },
      ],
    },
  };

  /* ── 9 Living Cambodian NPCs with Unique Personalities, Voices & Multi-Turn Trees ── */
  const NPCS = [
    {
      id: 'dara', name: 'Dara', role: 'Village Greeter', zone: 'village',
      x: 560, y: 350, home: { x: 560, y: 350 },
      waypoints: [{ x: 520, y: 345 }, { x: 645, y: 360 }, { x: 580, y: 420 }],
      portrait: './images/voice-quest-rpg/npc-dara.jpg',
      shirt: '#38bdf8', hair: '#1c1917', skin: '#e6b18a',
      pitch: 1.08, rate: 0.96,
      bio: 'Cheerful student in Phum Lotus who loves greeting new friends and playing badminton by the river.',
      ambient: ['What a sunny morning!', 'Let’s practice English!', 'Hi neighbor!'],
      dialogue: {
        start: {
          emotion: 'happy',
          npc: (st) =>
            st.memory.daraMet
              ? `Welcome back, ${st.player.name}! ${st.memory.mood ? `Last time you felt ${st.memory.mood}. ` : ''}How are you feeling today?`
              : `Hello! Welcome to Phum Lotus Village! My name is Dara. Say hello and tell me your name!`,
          prompts: {
            A1: ['Hello Dara! My name is Alex.', 'Hi! Nice to meet you!'],
            A2: ['Hello Dara, nice to meet you!', 'Good morning! How are you today?'],
            B1: ['Hi Dara! I am excited to explore Phum Lotus today.'],
          },
          keywords: ['hello', 'hi', 'morning', 'name', 'nice', 'good', 'happy', 'great', 'fine', 'excited'],
          next: (text, st) => {
            st.memory.daraMet = true;
            if (/tired|sleepy|sad|stressed/i.test(text)) {
              st.memory.mood = 'tired';
              return 'mood_tired';
            }
            if (/excited|great|amazing|happy|good/i.test(text)) {
              st.memory.mood = 'happy';
              return 'mood_happy';
            }
            return 'ask_mood';
          },
        },
        ask_mood: {
          emotion: 'curious',
          npc: (st) => `Nice to meet you, ${st.player.name}! How are you feeling today?`,
          prompts: {
            A1: ["I'm happy!", "I'm good, thank you!", "I'm excited!"],
            A2: ["I am feeling great today!", "I'm a little tired, how about you?"],
            B1: ["I feel energized and ready to practice English!"],
          },
          keywords: ['happy', 'good', 'great', 'fine', 'excited', 'tired', 'okay', 'wonderful', 'thank'],
          next: (text, st) => {
            if (/tired|sleepy|busy/i.test(text)) { st.memory.mood = 'tired'; return 'mood_tired'; }
            st.memory.mood = 'happy';
            return 'mood_happy';
          },
        },
        mood_happy: {
          emotion: 'excited',
          npc: () => `That's wonderful! Why are you happy today?`,
          prompts: {
            A1: ['I like learning English!', 'It is a sunny day!', 'I love meeting new friends!'],
            A2: ['I am happy because I can explore Cambodia and talk to people.'],
            B1: ['Because speaking English in a lively community feels fun and natural!'],
          },
          keywords: ['because', 'like', 'love', 'sunny', 'english', 'friend', 'explore', 'fun', 'school', 'day', 'happy', 'music', 'food'],
          onComplete: (st) => markQuestStep(st, 'q_welcome', 'dara'),
          next: () => 'wrap',
        },
        mood_tired: {
          emotion: 'thoughtful',
          npc: () => `Oh, I understand! What helps you relax when you feel tired?`,
          prompts: {
            A1: ['I drink iced coffee.', 'I listen to music.', 'I walk in the park.'],
            A2: ['I like to drink fresh coconut water at the market.'],
            B1: ['Taking a peaceful walk by the Mekong River always recharges me.'],
          },
          keywords: ['drink', 'coffee', 'coconut', 'music', 'walk', 'park', 'rest', 'sleep', 'read', 'water', 'relax', 'fruit'],
          onComplete: (st) => markQuestStep(st, 'q_welcome', 'dara'),
          next: () => 'wrap',
        },
        wrap: {
          emotion: 'proud',
          npc: (st) => `Awesome English, ${st.player.name}! Head south to Phsar Market to meet Auntie Maly, or east to Champa School!`,
          end: true,
        },
      },
    },
    {
      id: 'maly', name: 'Auntie Maly', role: 'Market Fruit & Coffee Vendor', zone: 'market',
      x: 335, y: 255, home: { x: 335, y: 255 },
      waypoints: [{ x: 335, y: 255 }, { x: 390, y: 265 }, { x: 320, y: 285 }],
      portrait: './images/voice-quest-rpg/npc-maly.jpg',
      shirt: '#0f766e', hair: '#334155', skin: '#d89b72',
      pitch: 1.12, rate: 0.94,
      bio: 'Warm-hearted fruit & iced coffee vendor at Phsar Market wearing her signature red krama scarf.',
      ambient: ['Fresh sweet mangoes!', 'Try our iced coffee!', 'Welcome to Phsar Market!'],
      dialogue: {
        start: {
          emotion: 'happy',
          npc: (st) =>
            st.quests.q_bopha?.steps?.found && !st.quests.q_bopha?.done
              ? `Oh! Thank goodness — you brought Little Bopha back safely! Can you tell me where you found her?`
              : st.memory.favFruit
                ? `Welcome back, ${st.player.name}! Would you like another sweet ${st.memory.favFruit} or an iced coffee today?`
                : `Welcome to Phsar Market! We have sweet mangoes, red dragonfruit, and cold iced coffee. What would you like to order?`,
          prompts: {
            A1: ['Hello! I would like a mango, please.', 'Can I have iced coffee, please?'],
            A2: ['Good morning Auntie! I found Bopha at Mekong Park.', 'I would like two mangoes and an iced coffee, please.'],
            B1: ['Excuse me Auntie Maly, could I order fresh mangoes and iced coffee, please?'],
          },
          keywords: ['mango', 'coffee', 'dragonfruit', 'coconut', 'fruit', 'please', 'like', 'order', 'hello', 'park', 'bopha', 'found', 'river'],
          next: (text, st) => {
            markQuestStep(st, 'q_welcome', 'maly');
            if (st.quests.q_bopha?.steps?.found && !st.quests.q_bopha?.done) {
              markQuestStep(st, 'q_bopha', 'returned');
              return 'bopha_thanks';
            }
            if (/coffee/i.test(text)) st.memory.favFruit = 'iced coffee';
            else if (/dragon/i.test(text)) st.memory.favFruit = 'dragonfruit';
            else st.memory.favFruit = 'sweet mango';
            markQuestStep(st, 'q_market', 'order');
            return 'ask_price';
          },
        },
        ask_price: {
          emotion: 'curious',
          npc: (st) => `One fresh ${st.memory.favFruit || 'mango'} coming right up! Ask me how much it costs!`,
          prompts: {
            A1: ['How much is it?', 'How much does it cost?'],
            A2: ['How much is the mango, please?', 'How much do I pay?'],
            B1: ['Could you tell me how much that costs altogether, please?'],
          },
          keywords: ['how', 'much', 'cost', 'price', 'pay', 'dollars', 'riel'],
          next: (_, st) => {
            markQuestStep(st, 'q_market', 'price');
            return 'polite_thanks';
          },
        },
        polite_thanks: {
          emotion: 'excited',
          npc: () => `That's only 4,000 riel — one dollar! Here is your fresh treat. How do you reply politely?`,
          prompts: {
            A1: ['Thank you very much!', 'Thanks! Have a nice day!'],
            A2: ['Thank you so much, Auntie Maly! It looks delicious!'],
            B1: ['Thank you kindly! I really appreciate your help today.'],
          },
          keywords: ['thank', 'thanks', 'delicious', 'nice', 'day', 'good', 'appreciate'],
          onComplete: (st) => markQuestStep(st, 'q_market', 'thanks'),
          next: () => 'wrap',
        },
        bopha_thanks: {
          emotion: 'grateful',
          npc: (st) => `Bless your kind heart, ${st.player.name}! You comforted Bopha and walked her right home. Here are 40 bonus coins and my deepest thanks!`,
          end: true,
        },
        wrap: {
          emotion: 'proud',
          npc: () => `Wonderful polite English! Try the Market Quick-Order Rush cart nearby anytime for bonus coins!`,
          end: true,
        },
      },
    },
    {
      id: 'rithy', name: 'Uncle Rithy', role: 'Tuk-Tuk Driver', zone: 'transit',
      x: 415, y: 365, home: { x: 415, y: 365 },
      waypoints: [{ x: 390, y: 360 }, { x: 545, y: 390 }, { x: 465, y: 455 }],
      portrait: './images/voice-quest-rpg/npc-rithy.jpg',
      shirt: '#06b6d4', hair: '#18181b', skin: '#cf936b',
      pitch: 0.90, rate: 0.98,
      bio: 'Jolly Phnom Penh tuk-tuk driver who knows every turn, temple, and shortcut in the city.',
      ambient: ['Tuk-tuk ready!', 'Where to today?', 'Beep beep!'],
      dialogue: {
        start: {
          emotion: 'happy',
          npc: (st) => `Hey there, ${st.player.name}! Hop in Uncle Rithy's tuk-tuk! Where do you want to go today?`,
          prompts: {
            A1: ['Hello! Please take me to the temple.', 'Can you go to Mekong Park?'],
            A2: ['Excuse me, how do I get to Wat Santipheap Temple?'],
            B1: ['Hi Uncle Rithy! Could you tell me the quickest way to the Festival Plaza?'],
          },
          keywords: ['temple', 'park', 'market', 'school', 'festival', 'where', 'how', 'get', 'go', 'take', 'hello', 'please'],
          next: (text, st) => {
            markQuestStep(st, 'q_welcome', 'rithy');
            markQuestStep(st, 'q_directions', 'ask');
            if (/festival/i.test(text)) st.memory.favPlace = 'Festival Plaza';
            else if (/park/i.test(text)) st.memory.favPlace = 'Mekong Park';
            else st.memory.favPlace = 'Wat Santipheap Temple';
            return 'practice_dir';
          },
        },
        practice_dir: {
          emotion: 'curious',
          npc: (st) => `Great choice! Let's practice giving clear directions to ${st.memory.favPlace || 'the temple'}. Tell me which way to turn!`,
          prompts: {
            A1: ['Go straight and turn left.', 'Go straight and turn right.'],
            A2: ['Walk straight ahead, then turn right near the market.'],
            B1: ['Go straight past the golden dome, then take a left toward the river.'],
          },
          keywords: ['straight', 'left', 'right', 'north', 'south', 'east', 'west', 'turn', 'past', 'ahead', 'near'],
          onComplete: (st) => markQuestStep(st, 'q_directions', 'give'),
          next: () => 'wrap',
        },
        wrap: {
          emotion: 'excited',
          npc: () => `Crystal clear directions! You sound like a true city navigator!`,
          end: true,
        },
      },
    },
    {
      id: 'leakhena', name: 'Teacher Leakhena', role: 'English Mentor', zone: 'school',
      x: 455, y: 315, home: { x: 455, y: 315 },
      waypoints: [{ x: 430, y: 315 }, { x: 520, y: 335 }, { x: 470, y: 380 }],
      portrait: './images/voice-quest-rpg/npc-leakhena.jpg',
      shirt: '#a855f7', hair: '#1c1917', skin: '#e8b896',
      pitch: 1.14, rate: 0.93,
      bio: 'Warm English teacher at Champa Community School who celebrates every student’s voice.',
      ambient: ['Speak with confidence!', 'Every word counts!', 'Ready for a project?'],
      dialogue: {
        start: {
          emotion: 'happy',
          npc: (st) => `Good day, ${st.player.name}! Ready for our Champa School English Project? Tell me your favorite place in our town!`,
          prompts: {
            A1: ['My favorite place is the lotus village.', 'I like Mekong Park!'],
            A2: ['My favorite place is Phsar Market because the fruit is sweet.'],
            B1: ['I love Wat Santipheap Temple because it is peaceful and rich in history.'],
          },
          keywords: ['favorite', 'like', 'love', 'village', 'market', 'park', 'temple', 'school', 'festival', 'place', 'because'],
          next: (_, st) => {
            markQuestStep(st, 'q_school', 'teacher');
            return 'explain_why';
          },
        },
        explain_why: {
          emotion: 'curious',
          npc: () => `Wonderful topic! Now give one reason why visitors from around the world should visit Cambodia!`,
          prompts: {
            A1: ['The people are very kind.', 'The food is delicious!'],
            A2: ['Visitors will love the friendly people, lotus ponds, and ancient temples.'],
            B1: ['Cambodia has warm hospitality, vibrant festivals, and inspiring cultural heritage.'],
          },
          keywords: ['kind', 'friendly', 'food', 'delicious', 'temple', 'culture', 'beautiful', 'people', 'festival', 'warm', 'history', 'visit'],
          onComplete: (st) => markQuestStep(st, 'q_school', 'present'),
          next: () => 'wrap',
        },
        wrap: {
          emotion: 'proud',
          npc: (st) => `A+ speaking presentation, ${st.player.name}! Remember to check Sopheak nearby to finish your team notes!`,
          end: true,
        },
      },
    },
    {
      id: 'sopheak', name: 'Sopheak', role: 'Project Partner', zone: 'school',
      x: 680, y: 345, home: { x: 680, y: 345 },
      waypoints: [{ x: 660, y: 345 }, { x: 750, y: 380 }, { x: 690, y: 425 }],
      portrait: './images/voice-quest-rpg/npc-sopheak.jpg',
      shirt: '#f8fafc', hair: '#1e293b', skin: '#e6b48e',
      pitch: 1.18, rate: 0.98,
      bio: 'Curious honor student with a green notebook collecting real English interviews across Cambodia.',
      ambient: ['Writing down new words!', 'Let’s work together!', 'What a cool idea!'],
      dialogue: {
        start: {
          emotion: 'excited',
          npc: (st) => `Hey ${st.player.name}! I'm making a class poster about daily English. What do you like doing after school?`,
          prompts: {
            A1: ['I like reading books.', 'I play badminton with friends.'],
            A2: ['After school, I like practicing English and listening to music.'],
            B1: ['I enjoy exploring the riverside park and learning new English phrases.'],
          },
          keywords: ['read', 'book', 'play', 'music', 'english', 'study', 'friend', 'draw', 'sport', 'badminton', 'walk', 'like', 'enjoy', 'game'],
          next: (_, st) => {
            markQuestStep(st, 'q_school', 'sopheak');
            return 'follow';
          },
        },
        follow: {
          emotion: 'curious',
          npc: () => `Ooh, I'm writing that in my notebook! Who should we interview next — Elder Vanna or Channary?`,
          prompts: {
            A1: ['Let’s interview Elder Vanna!', 'Let’s talk to Channary!'],
            A2: ['I think we should interview Elder Vanna at the temple.'],
            B1: ['Let’s visit both so our project shares tradition and modern festival life!'],
          },
          keywords: ['vanna', 'elder', 'temple', 'channary', 'festival', 'both', 'interview', 'visit', 'talk'],
          next: () => 'wrap',
        },
        wrap: {
          emotion: 'happy',
          npc: () => `Teamwork makes speaking easy! See you around campus!`,
          end: true,
        },
      },
    },
    {
      id: 'vanna', name: 'Elder Vanna', role: 'Temple Storyteller', zone: 'temple',
      x: 560, y: 350, home: { x: 560, y: 350 },
      waypoints: [{ x: 525, y: 355 }, { x: 610, y: 375 }, { x: 560, y: 420 }],
      portrait: './images/voice-quest-rpg/npc-vanna.jpg',
      shirt: '#f5f0e1', hair: '#e2e8f0', skin: '#c98e68',
      pitch: 0.84, rate: 0.88,
      bio: 'Gentle village elder who shares stories of Khmer resilience, lotus flowers, and peace.',
      ambient: ['Peace begins with kindness.', 'Listen to the wind chimes...', 'Welcome, young traveler.'],
      dialogue: {
        start: {
          emotion: 'happy',
          npc: (st) => `Peace be with you, ${st.player.name}. Welcome to Wat Santipheap Gardens. Would you like to ask me a question about the lotus flower?`,
          prompts: {
            A1: ['Why is the lotus special?', 'Can you tell me a story, please?'],
            A2: ['Good afternoon Elder Vanna. What does the lotus flower mean in Cambodia?'],
            B1: ['Hello Elder Vanna! Could you share why the lotus is an important symbol here?'],
          },
          keywords: ['lotus', 'story', 'symbol', 'mean', 'why', 'special', 'cambodia', 'history', 'temple', 'please', 'question'],
          next: (_, st) => {
            markQuestStep(st, 'q_elder', 'ask');
            return 'wisdom';
          },
        },
        wisdom: {
          emotion: 'thoughtful',
          npc: () => `The lotus grows from muddy water yet blooms clean and bright — just like learning a new language step by step. What have you learned today?`,
          prompts: {
            A1: ['I learned to be brave!', 'I learned new English words!'],
            A2: ['I learned that practicing every day helps me grow stronger.'],
            B1: ['I learned that kindness and curiosity connect people across cultures.'],
          },
          keywords: ['learn', 'brave', 'grow', 'kind', 'english', 'practice', 'strong', 'word', 'speak', 'help', 'culture', 'step'],
          onComplete: (st) => markQuestStep(st, 'q_elder', 'reflect'),
          next: () => 'wrap',
        },
        wrap: {
          emotion: 'proud',
          npc: () => `Wise words! Hint from an old friend: look northeast past the tall palms to discover our Hidden Lotus Sanctuary!`,
          end: true,
        },
      },
    },
    {
      id: 'bopha', name: 'Little Bopha', role: 'Lost Child at Mekong Park', zone: 'park',
      x: 470, y: 390, home: { x: 470, y: 390 },
      waypoints: [{ x: 455, y: 385 }, { x: 515, y: 405 }, { x: 480, y: 430 }],
      portrait: './images/voice-quest-rpg/npc-bopha.jpg',
      shirt: '#fb7185', hair: '#1c1917', skin: '#e8b795',
      pitch: 1.32, rate: 0.96,
      bio: 'Sweet 8-year-old girl holding a glowing lotus who wandered from Auntie Maly’s stall.',
      ambient: ['Where is Auntie Maly?', 'Look at my pink lotus!', 'Excuse me...'],
      dialogue: {
        start: {
          emotion: 'shy',
          npc: (st) =>
            st.quests.q_bopha?.done
              ? `Yay, ${st.player.name}! Thank you again for helping me! Look how pretty the riverboats are!`
              : `Excuse me... I got lost chasing a blue butterfly. Can you help me?`,
          prompts: {
            A1: ['Don’t worry! I can help you.', 'What is your name?'],
            A2: ['It’s okay, Bopha! Don’t be scared. Where does your family work?'],
            B1: ['Don’t worry at all! Tell me your name and where we can find your family.'],
          },
          keywords: ['help', 'worry', 'okay', 'name', 'safe', 'family', 'where', 'scared', 'mother', 'auntie', 'yes', 'sure'],
          next: (_, st) => {
            markQuestStep(st, 'q_bopha', 'comfort');
            return 'guide';
          },
        },
        guide: {
          emotion: 'happy',
          npc: () => `My name is Bopha! My Auntie Maly sells sweet mangoes at Phsar Market! Will you walk with me there?`,
          prompts: {
            A1: ['Yes! Let’s go to the market!', 'Come with me to Auntie Maly!'],
            A2: ['Of course! Let’s walk east to Phsar Market together.'],
            B1: ['Certainly! Stay close to me and we will be back at Auntie Maly’s stall in a minute.'],
          },
          keywords: ['yes', 'market', 'go', 'walk', 'come', 'together', 'maly', 'east', 'sure', 'course', 'close'],
          onComplete: (st) => markQuestStep(st, 'q_bopha', 'found'),
          next: () => 'wrap',
        },
        wrap: {
          emotion: 'grateful',
          npc: () => `Thank you! Walk east back to Phsar Market and tell Auntie Maly you found me!`,
          end: true,
        },
      },
    },
    {
      id: 'channary', name: 'Channary', role: 'Water Festival Artist', zone: 'festival',
      x: 575, y: 390, home: { x: 575, y: 390 },
      waypoints: [{ x: 520, y: 390 }, { x: 640, y: 395 }, { x: 575, y: 430 }],
      portrait: './images/voice-quest-rpg/npc-channary.jpg',
      shirt: '#f59e0b', hair: '#18181b', skin: '#dfa680',
      pitch: 1.16, rate: 1.0,
      bio: 'Radiant festival performer leading the Bon Om Touk boat race songs and sky-lantern wishes.',
      ambient: ['Happy Bon Om Touk!', 'Light a lantern with a wish!', 'Hear the festival drums!'],
      dialogue: {
        start: {
          emotion: 'excited',
          npc: (st) => `Happy Bon Om Touk, ${st.player.name}! Tonight we celebrate with boat races and glowing lanterns! What do you see around the plaza?`,
          prompts: {
            A1: ['I see bright lanterns!', 'The festival is beautiful!'],
            A2: ['I see glowing lanterns, a drum stage, and boats on the river!'],
            B1: ['The riverside looks magical with golden lanterns reflecting on the water!'],
          },
          keywords: ['lantern', 'boat', 'river', 'bright', 'beautiful', 'music', 'drum', 'light', 'happy', 'festival', 'water', 'stage'],
          next: (_, st) => {
            markQuestStep(st, 'q_festival', 'greet');
            return 'wish';
          },
        },
        wish: {
          emotion: 'happy',
          npc: () => `Now speak a warm wish for your friends, family, or Cambodia to make the festival lanterns shine!`,
          prompts: {
            A1: ['I wish everyone happiness!', 'Good luck and peace to all!'],
            A2: ['I wish my family health, joy, and a bright future!'],
            B1: ['May our community always stay kind, curious, and proud of its heritage!'],
          },
          keywords: ['wish', 'happy', 'happiness', 'peace', 'health', 'joy', 'luck', 'love', 'future', 'family', 'friend', 'cambodia', 'kind'],
          onComplete: (st) => markQuestStep(st, 'q_festival', 'wish'),
          next: () => 'wrap',
        },
        wrap: {
          emotion: 'excited',
          npc: () => `Your wish lit up the night sky! Tap the 3 Wish Lanterns by the water to release them too!`,
          end: true,
        },
      },
    },
    {
      id: 'arun', name: 'Master Arun', role: 'Sanctuary Storyteller', zone: 'secret',
      x: 580, y: 345, home: { x: 580, y: 345 },
      waypoints: [{ x: 560, y: 345 }, { x: 605, y: 350 }],
      portrait: './images/voice-quest-rpg/npc-vanna.jpg',
      shirt: '#10b981', hair: '#e2e8f0', skin: '#d89b72',
      pitch: 0.94, rate: 0.90,
      bio: 'Keeper of the Hidden Lotus Sanctuary who awards the Conversation Master blessing.',
      ambient: ['You found the secret sanctuary!', 'Speak from your heart...'],
      dialogue: {
        start: {
          emotion: 'proud',
          npc: (st) => `Remarkable! You discovered the Hidden Lotus Sanctuary, ${st.player.name}! Tell me a short story about your adventure across Cambodia today!`,
          prompts: {
            A1: ['I met friends and spoke English!', 'I visited the village, market, and temple!'],
            A2: ['Today I ordered sweet mangoes, helped Little Bopha, and talked with Elder Vanna!'],
            B1: ['Exploring every community from Phum Lotus to the Festival Plaza made speaking English feel effortless!'],
          },
          keywords: ['met', 'friend', 'english', 'village', 'market', 'temple', 'bopha', 'mango', 'festival', 'today', 'adventure', 'speak', 'helped'],
          onComplete: (st) => markQuestStep(st, 'q_secret', 'story'),
          next: () => 'wrap',
        },
        wrap: {
          emotion: 'excited',
          npc: () => `You are a true Cambodian English Ambassador! Enjoy +120 bonus XP and the Golden Lotus Crest!`,
          end: true,
        },
      },
    },
  ];

  /* ── 8 Meaningful Real-World Speaking Quests (7 Main + 1 Hidden!) ── */
  const QUEST_DEFS = [
    {
      id: 'q_welcome', title: 'Welcome to Phum Lotus', zone: 'village', npc: 'dara',
      desc: 'Introduce yourself in English to 3 friendly locals: Dara (Village), Auntie Maly (Market), and Uncle Rithy (Tuk-Tuk Hub).',
      steps: ['dara', 'maly', 'rithy'],
      stepLabels: { dara: 'Greet Dara in Phum Lotus Village', maly: 'Meet Auntie Maly at Phsar Market', rithy: 'Say hi to Uncle Rithy at Tuk-Tuk Hub' },
      rewardXp: 75, rewardCoins: 45, badge: 'Village Greeter',
    },
    {
      id: 'q_market', title: 'Morning Market Feast', zone: 'market', npc: 'maly',
      desc: 'Order fresh fruit or iced coffee from Auntie Maly, ask the price, and thank her politely.',
      steps: ['order', 'price', 'thanks'],
      stepLabels: { order: 'Order fruit or iced coffee', price: 'Ask how much it costs', thanks: 'Thank Auntie Maly politely' },
      rewardXp: 85, rewardCoins: 55, badge: 'Market Negotiator',
    },
    {
      id: 'q_directions', title: 'Find the Way', zone: 'transit', npc: 'rithy',
      desc: 'Chat with Uncle Rithy at the Tuk-Tuk Hub to ask for and give clear English directions.',
      steps: ['ask', 'give'],
      stepLabels: { ask: 'Ask Uncle Rithy for a ride or route', give: 'Give clear left/right/straight directions' },
      rewardXp: 70, rewardCoins: 40, badge: 'City Navigator',
    },
    {
      id: 'q_bopha', title: 'Help Little Bopha', zone: 'park', npc: 'bopha',
      desc: 'Comfort lost child Bopha in Mekong Riverside Park and guide her safely back to Auntie Maly at Phsar Market.',
      steps: ['comfort', 'found', 'returned'],
      stepLabels: { comfort: 'Comfort Little Bopha in Mekong Park', found: 'Offer to walk with her to the Market', returned: 'Tell Auntie Maly at Phsar Market' },
      rewardXp: 100, rewardCoins: 65, badge: 'Kind Neighbor',
    },
    {
      id: 'q_elder', title: 'Interview the Village Elder', zone: 'temple', npc: 'vanna',
      desc: 'Visit Elder Vanna at Wat Santipheap Gardens, ask about the lotus symbol, and share what you learned.',
      steps: ['ask', 'reflect'],
      stepLabels: { ask: 'Ask Elder Vanna about the lotus', reflect: 'Share what you learned today' },
      rewardXp: 90, rewardCoins: 50, badge: 'Heritage Listener',
    },
    {
      id: 'q_school', title: 'Champa School Project', zone: 'school', npc: 'leakhena',
      desc: 'Work with Teacher Leakhena and Sopheak to present your favorite Cambodian place in English.',
      steps: ['teacher', 'present', 'sopheak'],
      stepLabels: { teacher: 'Share your favorite place with Teacher Leakhena', present: 'Give a reason visitors love Cambodia', sopheak: 'Share your after-school hobby with Sopheak' },
      rewardXp: 95, rewardCoins: 55, badge: 'Star Presenter',
    },
    {
      id: 'q_festival', title: 'Lanterns of Bon Om Touk', zone: 'festival', npc: 'channary',
      desc: 'Celebrate with Channary at Festival Plaza and speak a warm wish to illuminate the festival lanterns!',
      steps: ['greet', 'wish', 'lantern'],
      stepLabels: { greet: 'Describe the Festival Plaza to Channary', wish: 'Speak a warm festival wish', lantern: 'Light a Wish Lantern by the river' },
      rewardXp: 105, rewardCoins: 70, badge: 'Festival Spark',
    },
    {
      id: 'q_secret', title: 'Secret of the Golden Lotus', zone: 'secret', npc: 'arun', hidden: true,
      desc: 'Hidden Quest! Enter the Misty Bamboo Path northeast of Wat Santipheap Temple and tell Master Arun your story.',
      steps: ['enter', 'story'],
      stepLabels: { enter: 'Discover the Hidden Lotus Sanctuary', story: 'Tell Master Arun about your English adventure' },
      rewardXp: 130, rewardCoins: 100, badge: 'Lotus Legend',
    },
  ];

  const DAILY_CHALLENGES = [
    { prompt: 'Good morning! My name is Sam and I love learning English.', tip: 'Warm greeting + clear introduction' },
    { prompt: 'Excuse me, how much is one sweet mango and iced coffee?', tip: 'Polite market ordering' },
    { prompt: 'Go straight ahead and turn left near the lotus pond.', tip: 'Clear community directions' },
    { prompt: 'I am excited to celebrate Bon Om Touk with my family!', tip: 'Sharing emotions & culture' },
  ];

  /* ── Default Persistent Player State ── */
  function defaultState() {
    const savedName =
      (window.CMC_NG && window.CMC_NG.get && window.CMC_NG.get()) ||
      safeGet('cmc-student-name') ||
      'Explorer';
    return {
      mode: 'rpg', // 'rpg' | 'classic'
      welcomed: false,
      zone: 'village',
      levelDiff: 'A1', // 'A1' | 'A2' | 'B1'
      player: {
        name: String(savedName || 'Explorer').slice(0, 20),
        x: 460,
        y: 390,
        skin: SKINS[1],
        hair: HAIRS[0],
        outfit: 'student',
        accessory: 'none',
        pet: 'kitten',
        unlockedPets: ['kitten'],
      },
      xp: 0,
      level: 1,
      coins: 25,
      streak: 1,
      lastDay: new Date().toISOString().slice(0, 10),
      dailyDoneDay: '',
      totalSpoken: 0,
      avgScore: 0,
      scoreSamples: 0,
      hearts: { dara: 1, maly: 0, rithy: 0, leakhena: 0, sopheak: 0, vanna: 0, bopha: 0, channary: 0, arun: 0 },
      memory: {},
      quests: {},
      activeQuest: 'q_welcome',
      collectibles: [],
      litLanterns: [],
      achievements: [],
      srs: {}, // phrase -> { count, best, last }
      timeOfDay: 0.22, // 0=dawn, 0.25=day, 0.62=sunset, 0.82=night
      weather: 'sunny', // 'sunny' | 'breeze' | 'rain' | 'lanterns'
      musicOn: true,
      voiceOn: true,
    };
  }

  function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

  function loadState() {
    const base = defaultState();
    try {
      const raw = safeGet(STORAGE_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      return {
        ...base,
        ...parsed,
        player: { ...base.player, ...(parsed.player || {}) },
        hearts: { ...base.hearts, ...(parsed.hearts || {}) },
        memory: { ...(parsed.memory || {}) },
        quests: { ...(parsed.quests || {}) },
        srs: { ...(parsed.srs || {}) },
      };
    } catch {
      return base;
    }
  }

  let state = loadState();
  function saveState() {
    safeSet(STORAGE_KEY, JSON.stringify(state));
  }

  /* ── Helper: Titles, XP, Achievements, Quests ── */
  function xpForLevel(lv) { return 80 + (lv - 1) * 45; }
  function currentTitle() {
    let t = TITLES[0].title;
    for (const item of TITLES) if (state.level >= item.level) t = item.title;
    return t;
  }

  function awardRewards(xp, coins, worldX, worldY) {
    state.xp += xp;
    state.coins += coins;
    let leveled = false;
    while (state.xp >= xpForLevel(state.level)) {
      state.xp -= xpForLevel(state.level);
      state.level++;
      leveled = true;
    }
    if (typeof worldX === 'number' && typeof worldY === 'number') {
      spawnPopup(worldX, worldY - 36, `+${xp} XP`, '#45d7d0');
      if (coins > 0) spawnPopup(worldX + 26, worldY - 56, `+${coins} 🪙`, '#fbbf24');
      spawnBurst(worldX, worldY - 12, '#45d7d0', 18);
    }
    if (leveled) {
      SFX.levelUp();
      pushToast(`🎉 Level Up! Level ${state.level}`, `New Title: ${currentTitle()}`);
      spawnBurst(playerMotion.x, playerMotion.y - 20, '#fbbf24', 36);
      playerMotion.celebrate = 1.4;
    }
    saveState();
    renderHud();
  }

  function unlockAchievement(id, title, detail) {
    if (state.achievements.includes(id)) return;
    state.achievements.push(id);
    SFX.fanfare();
    pushToast(`🏅 Badge Unlocked: ${title}`, detail);
    saveState();
  }

  function markQuestStep(st, questId, stepKey) {
    const def = QUEST_DEFS.find((q) => q.id === questId);
    if (!def) return;
    if (!st.quests[questId]) st.quests[questId] = { steps: {}, done: false };
    const q = st.quests[questId];
    if (q.steps[stepKey]) return;
    q.steps[stepKey] = true;
    const allDone = def.steps.every((s) => q.steps[s]);
    if (allDone && !q.done) {
      q.done = true;
      SFX.fanfare();
      awardRewards(def.rewardXp, def.rewardCoins, playerMotion.x, playerMotion.y);
      unlockAchievement(`quest_${questId}`, def.badge, `Completed "${def.title}"!`);
      pushToast(`🌟 Quest Complete: ${def.title}`, `+${def.rewardXp} XP · +${def.rewardCoins} Coins`);
      // Auto-advance activeQuest to next incomplete non-hidden quest
      const nextQ = QUEST_DEFS.find((d) => !d.hidden && !st.quests[d.id]?.done);
      if (nextQ) st.activeQuest = nextQ.id;
      // Post progress milestone to CMC Class Leaderboard silently when signed in or named
      postRpgToLeaderboard(def.title);
    }
    saveState();
    renderQuestPill();
  }

  /* ── Pronunciation Scoring & Word-by-Word Highlighting ── */
  function cleanWord(w) { return String(w || '').toLowerCase().replace(/[^a-z0-9']/g, ''); }
  function levenshtein(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      }
    }
    return dp[m][n];
  }

  function evaluateSpeech(spoken, expectedKeywords, samplePhrases, rawConfidence) {
    const words = String(spoken || '').trim().split(/\s+/).filter(Boolean);
    const cleaned = words.map(cleanWord).filter(Boolean);
    if (!cleaned.length) {
      return { score: 0, pass: false, tokens: [], matchedCount: 0 };
    }
    // Build vocabulary pool from keywords + sample prompt words
    const pool = new Set(expectedKeywords.map(cleanWord));
    for (const p of samplePhrases || []) {
      for (const w of p.split(/\s+/)) {
        const cw = cleanWord(w);
        if (cw.length >= 2) pool.add(cw);
      }
    }
    const poolArr = [...pool];
    let keywordHit = 0;
    let closeHits = 0;
    const tokens = words.map((raw) => {
      const cw = cleanWord(raw);
      if (!cw) return { raw, status: 'ok' };
      if (pool.has(cw)) {
        keywordHit++;
        return { raw, status: 'ok' };
      }
      // Fuzzy match (pronunciation near-miss)
      let bestDist = 99;
      let suggestion = '';
      for (const target of poolArr) {
        if (Math.abs(target.length - cw.length) > 2) continue;
        const d = levenshtein(cw, target);
        if (d < bestDist) { bestDist = d; suggestion = target; }
      }
      if (bestDist === 1 && cw.length >= 3) {
        closeHits++;
        return { raw, status: 'close', suggestion };
      }
      // Accept valid natural English filler/conversational words cleanly
      if (cw.length >= 2) {
        return { raw, status: 'ok' };
      }
      return { raw, status: 'miss' };
    });

    const hasExpected = cleaned.some((w) => expectedKeywords.some((k) => levenshtein(w, cleanWord(k)) <= 1));
    const baseConf = typeof rawConfidence === 'number' && rawConfidence > 0 ? rawConfidence * 100 : 89;
    const lengthBonus = Math.min(10, cleaned.length * 2.2);
    const hitScore = hasExpected ? 92 : (keywordHit > 0 ? 84 : 74);
    const rawScore = Math.round(hitScore * 0.55 + baseConf * 0.35 + lengthBonus - (tokens.filter((t) => t.status === 'miss').length * 8));
    const score = Math.max(48, Math.min(99, rawScore));
    const pass = score >= 68 && cleaned.length >= 1;
    return { score, pass, tokens, matchedCount: keywordHit + closeHits };
  }

  /* ── Procedural Khmer-Inspired Web Audio Engine ── */
  const SFX = {
    ctx: null,
    timer: null,
    step: 0,
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch {}
    },
    tone(freq, dur, vol, type) {
      if (!state.musicOn) return;
      this.init();
      if (!this.ctx) return;
      try {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type || 'triangle';
        o.frequency.setValueAtTime(freq, this.ctx.currentTime);
        g.gain.setValueAtTime(vol || 0.05, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0008, this.ctx.currentTime + (dur || 0.25));
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start();
        o.stop(this.ctx.currentTime + (dur || 0.25));
      } catch {}
    },
    startMusic() {
      if (this.timer) return;
      this.timer = setInterval(() => {
        if (!state.musicOn || document.hidden || state.mode !== 'rpg' || !this.ctx || this.ctx.state !== 'running') return;
        const z = ZONES[state.zone] || ZONES.village;
        const scale = z.musicScale;
        const pattern = [0, 2, 3, 4, 2, 5, 4, 1];
        const note = scale[pattern[this.step % pattern.length]];
        this.step++;
        if (this.step % 2 === 0 || state.zone === 'festival') {
          this.tone(note, 0.55, state.zone === 'temple' ? 0.024 : 0.032, state.zone === 'temple' ? 'sine' : 'triangle');
        }
      }, 640);
    },
    chime() { this.tone(523.25, 0.16, 0.07, 'sine'); setTimeout(() => this.tone(659.25, 0.22, 0.07, 'sine'), 85); setTimeout(() => this.tone(783.99, 0.3, 0.08, 'triangle'), 170); },
    coin() { this.tone(880, 0.1, 0.06, 'sine'); setTimeout(() => this.tone(1174.7, 0.18, 0.06, 'sine'), 75); },
    fanfare() { [523.3, 659.3, 784, 1046.5].forEach((f, i) => setTimeout(() => this.tone(f, 0.32, 0.07, 'triangle'), i * 110)); },
    levelUp() { [440, 554.4, 659.3, 880, 1108.7].forEach((f, i) => setTimeout(() => this.tone(f, 0.36, 0.08, 'triangle'), i * 95)); },
    softTap() { this.tone(320, 0.06, 0.025, 'sine'); },
  };

  /* ── NPC Voice Playback (TTS synced with animated talking portrait!) ── */
  function speakNpc(text, npc, slow) {
    if (!state.voiceOn || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.pitch = (npc && npc.pitch) || 1;
      u.rate = slow ? 0.72 : ((npc && npc.rate) || 0.96);
      const portraitEl = document.getElementById('rpgPortraitBox');
      if (portraitEl) portraitEl.classList.add('talking');
      if (npc) npcAnimTalk[npc.id] = 3.2;
      u.onend = u.onerror = () => {
        if (portraitEl) portraitEl.classList.remove('talking');
        if (npc) npcAnimTalk[npc.id] = 0;
      };
      window.speechSynthesis.speak(u);
    } catch {}
  }

  /* ── CMC Class Leaderboard POST (same pipeline as bundled Talk to me) ── */
  async function postRpgToLeaderboard(milestoneLabel) {
    try {
      const name = state.player.name || (window.CMC_NG && window.CMC_NG.get()) || 'Explorer';
      let token = safeGet('cmc-student-token');
      const exp = Number(safeGet('cmc-student-token-expires') || '0');
      if (token && exp <= Date.now() + 300000) {
        const ref = safeGet('cmc-student-refresh-token');
        if (ref) {
          const r = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(ref)}`,
          });
          if (r.ok) {
            const d = await r.json().catch(() => null);
            if (d?.id_token) {
              token = d.id_token;
              safeSet('cmc-student-token', token);
              safeSet('cmc-student-token-expires', String(Date.now() + (Number(d.expires_in) || 3600) * 1000 - 60000));
            }
          }
        }
      }
      const uid = token ? (safeGet('cmc-student-uid') || '') : '';
      const classId = uid ? (safeGet('cmc-student-classId') || '') : '';
      const completed = QUEST_DEFS.filter((q) => state.quests[q.id]?.done).length;
      const pct = Math.max(60, Math.min(100, Math.round(state.avgScore || (completed / QUEST_DEFS.length) * 100 || 85)));
      const body = {
        fields: {
          drillSlug: { stringValue: 'voice-quest-l1' },
          drillTitle: { stringValue: `Talk to me RPG · ${String(milestoneLabel || 'Adventure').slice(0, 60)}` },
          drillSource: { stringValue: 'learning-games' },
          studentName: { stringValue: String(name).slice(0, 40) },
          studentUid: { stringValue: uid },
          classId: classId ? { stringValue: classId } : { nullValue: null },
          scorePct: { integerValue: String(pct) },
          correctCount: { integerValue: String(Math.max(1, state.totalSpoken)) },
          totalCount: { integerValue: String(Math.max(1, state.totalSpoken)) },
          durationSeconds: { nullValue: null },
          submittedAt: { timestampValue: new Date().toISOString() },
        },
      };
      const res = await fetch(FIRESTORE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /* ==========================================================================
     LIVING WORLD 60-FPS ENGINE STATE
     ========================================================================== */
  const WORLD_W = 1160;
  const WORLD_H = 740;
  const keys = Object.create(null);
  const playerMotion = {
    x: state.player.x,
    y: state.player.y,
    targetX: null,
    targetY: null,
    vx: 0,
    vy: 0,
    facing: 1,
    walkPhase: 0,
    celebrate: 0,
    wave: 0,
  };
  const petMotion = { x: state.player.x - 36, y: state.player.y + 12, hop: 0 };
  const npcRuntime = {};
  const npcAnimTalk = {};
  for (const n of NPCS) {
    npcRuntime[n.id] = {
      x: n.x, y: n.y, wpIdx: 0, pause: Math.random() * 2.5,
      walkPhase: Math.random() * 6, facing: 1,
      bubble: '', bubbleTimer: 2 + Math.random() * 5,
      emotion: 'happy', celebrate: 0,
    };
  }

  const clouds = Array.from({ length: 6 }, (_, i) => ({
    x: i * 240 + Math.random() * 80, y: 40 + (i % 3) * 180,
    w: 110 + (i % 3) * 45, speed: 9 + (i % 4) * 3,
  }));
  const butterflies = Array.from({ length: 10 }, () => ({
    x: Math.random() * WORLD_W, y: 120 + Math.random() * 520,
    phase: Math.random() * 6.28, color: ['#fbbf24', '#f472b6', '#38bdf8', '#a78bfa'][Math.floor(Math.random() * 4)],
  }));
  const birds = Array.from({ length: 4 }, (_, i) => ({
    x: i * 320, y: 50 + i * 35, speed: 44 + i * 7, phase: i * 1.4,
  }));
  const weatherParticles = Array.from({ length: 64 }, () => ({
    x: Math.random() * WORLD_W, y: Math.random() * WORLD_H,
    v: 50 + Math.random() * 90, sway: Math.random() * 6.28, size: 2 + Math.random() * 3,
  }));
  const popups = [];
  const bursts = [];
  const ripples = [];

  function spawnPopup(x, y, text, color) {
    popups.push({ x, y, text, color: color || '#45d7d0', life: 1.5 });
  }
  function spawnBurst(x, y, color, count) {
    for (let i = 0; i < (count || 16); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 45 + Math.random() * 130;
      bursts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 35, color, life: 1, r: 2 + Math.random() * 3 });
    }
  }

  /* ── Active Dialogue & Mini-Game State ── */
  let activeDlg = null; // { npc, nodeKey }
  let activeMini = null; // Market Quick-Order Rush state
  let activeSpeechRec = null;
  let nearbyTarget = null;
  let canvas, ctx;

  /* ==========================================================================
     BUILD DOM SHELL & MOUNT INTO voice-quest.html
     ========================================================================== */
  function buildShell() {
    if (document.getElementById('vq-rpg-shell')) return;

    // Return-to-Adventure pill when user switches to Classic 15-Level Lab
    const returnPill = document.createElement('button');
    returnPill.id = 'vq-return-rpg-pill';
    returnPill.type = 'button';
    returnPill.textContent = '🌏 Adventure World RPG';
    returnPill.addEventListener('click', () => setMode('rpg'));
    document.body.appendChild(returnPill);

    const shell = document.createElement('div');
    shell.id = 'vq-rpg-shell';
    shell.setAttribute('aria-label', 'Srok Speak Cambodia Language Adventure RPG');
    shell.innerHTML = `
      <canvas id="vq-rpg-canvas" width="1160" height="740"></canvas>

      <!-- Top Floating Game HUD -->
      <div class="rpg-hud-top">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button type="button" class="rpg-pill rpg-player-card" id="rpgProfileBtn" title="Customize Avatar & Pet">
            <span class="rpg-avatar-ring" id="rpgAvatarRing">E<span class="rpg-lvl-badge" id="rpgLvlBadge">1</span></span>
            <span class="rpg-player-meta">
              <span class="rpg-player-name" id="rpgPlayerName">Explorer</span>
              <span class="rpg-player-title" id="rpgPlayerTitle">Beginner Speaker</span>
              <span class="rpg-xp-bar"><span class="rpg-xp-fill" id="rpgXpFill" style="width:10%"></span></span>
            </span>
          </button>
          <span class="rpg-pill" id="rpgZoneChip" style="font-size:12.5px;font-weight:800">🏡 Phum Lotus Village</span>
        </div>

        <div class="rpg-stat-chips">
          <button type="button" class="rpg-chip-btn gold" id="rpgCoinsBtn" title="Coins & Pet Shop">🪙 <span id="rpgCoins">25</span></button>
          <button type="button" class="rpg-chip-btn" id="rpgStreakBtn" title="Daily Speaking Challenge">🔥 <span id="rpgStreak">1</span>d</button>
          <button type="button" class="rpg-chip-btn" id="rpgTimeBtn" title="Cycle Day / Night">☀️ Day</button>
          <button type="button" class="rpg-chip-btn" id="rpgWeatherBtn" title="Change Weather">🌤️ Sunny</button>
          <button type="button" class="rpg-chip-btn" id="rpgMusicBtn" title="Toggle Ambient Music">🎵</button>
          <button type="button" class="rpg-chip-btn" id="rpgThemeBtn" title="Switch Light / Dark UI">☀️</button>
          <button type="button" class="rpg-chip-btn" id="rpgClassicBtn" title="Switch to Classic 15-Level Lab">📚 Classic 15 Levels</button>
        </div>
      </div>

      <div class="rpg-zone-banner" id="rpgZoneBanner" role="status" aria-live="polite"></div>
      <div class="rpg-toast-stack" id="rpgToastStack" aria-live="polite"></div>

      <!-- Floating Active Quest Pill -->
      <aside class="rpg-quest-pill" id="rpgQuestPill" aria-label="Active quest">
        <div class="rpg-quest-head">
          <span class="rpg-quest-eyebrow">Active Quest</span>
          <button type="button" class="rpg-mini-btn" id="rpgQuestOpenBtn">All Quests</button>
        </div>
        <div class="rpg-quest-title" id="rpgQuestTitle">Welcome to Phum Lotus</div>
        <div class="rpg-quest-step" id="rpgQuestStep">Greet Dara in Phum Lotus Village</div>
        <div class="rpg-quest-prog">
          <span class="rpg-quest-bar"><i id="rpgQuestFill" style="width:0%"></i></span>
          <span id="rpgQuestCount">0/3</span>
        </div>
        <button type="button" class="rpg-quest-go" id="rpgQuestGoBtn">🧭 Travel to quest area</button>
      </aside>

      <!-- Context-Sensitive Interaction Prompt -->
      <button type="button" class="rpg-interact-fab" id="rpgInteractBtn">
        <span id="rpgInteractLabel">Talk to Dara</span> <kbd>E</kbd>
      </button>

      <!-- Mobile / Quick Touch D-Pad -->
      <div class="rpg-touch-pad" aria-label="Movement pad">
        <span></span><button type="button" class="rpg-dpad-btn" data-dir="up" aria-label="Walk north">↑</button><span></span>
        <button type="button" class="rpg-dpad-btn" data-dir="left" aria-label="Walk west">←</button>
        <button type="button" class="rpg-dpad-btn" data-dir="act" aria-label="Interact">★</button>
        <button type="button" class="rpg-dpad-btn" data-dir="right" aria-label="Walk east">→</button>
        <span></span><button type="button" class="rpg-dpad-btn" data-dir="down" aria-label="Walk south">↓</button><span></span>
      </div>

      <!-- Bottom Game Dock -->
      <nav class="rpg-dock" aria-label="Adventure menu">
        <button type="button" class="rpg-dock-btn mic-world" id="rpgWorldMicBtn">🎤 Speak Command</button>
        <button type="button" class="rpg-dock-btn" data-open="map">🗺️ World Map</button>
        <button type="button" class="rpg-dock-btn" data-open="quests">📜 Quests</button>
        <button type="button" class="rpg-dock-btn" data-open="friends">💛 Friends</button>
        <button type="button" class="rpg-dock-btn" data-open="wardrobe">🎒 Avatar &amp; Pets</button>
        <button type="button" class="rpg-dock-btn" data-open="coach">📊 Coach &amp; Daily</button>
      </nav>

      <!-- Animated NPC Dialogue & Pronunciation Window -->
      <div class="rpg-dialogue-wrap" id="rpgDlgWrap" hidden>
        <div class="rpg-dialogue-card" role="dialog" aria-modal="true" aria-labelledby="rpgNpcName">
          <div class="rpg-dlg-top">
            <div class="rpg-portrait-box" id="rpgPortraitBox">
              <img id="rpgPortraitImg" src="./images/voice-quest-rpg/npc-dara.jpg" alt="" />
              <span class="rpg-emotion-tag" id="rpgEmotionTag">😊 Happy</span>
              <div class="rpg-mouth-bar" aria-hidden="true"><span></span><span></span><span></span></div>
            </div>
            <div>
              <div class="rpg-npc-head">
                <div>
                  <span class="rpg-npc-name" id="rpgNpcName">Dara</span>
                  <span class="rpg-npc-role" id="rpgNpcRole">Village Greeter</span>
                </div>
                <div style="display:flex;align-items:center;gap:10px">
                  <span class="rpg-hearts" id="rpgNpcHearts" aria-label="Friendship level">❤️🤍🤍🤍🤍</span>
                  <button type="button" class="rpg-dlg-close" id="rpgDlgClose" aria-label="Close dialogue">✕</button>
                </div>
              </div>
              <p class="rpg-npc-speech" id="rpgNpcSpeech"></p>
              <div class="rpg-memory-note" id="rpgMemoryNote"></div>
              <div class="rpg-npc-tools">
                <button type="button" class="rpg-mini-btn" id="rpgListenBtn">🔊 Listen</button>
                <button type="button" class="rpg-mini-btn" id="rpgSlowBtn">🐢 Slow</button>
                <button type="button" class="rpg-mini-btn" id="rpgLevelBtn">🎯 Level: A1</button>
              </div>
            </div>
          </div>

          <div class="rpg-feedback-box" id="rpgFeedbackBox" role="status" aria-live="polite">
            <div class="rpg-fb-row" id="rpgFbSummary"></div>
            <div class="rpg-fb-words" id="rpgFbWords"></div>
          </div>

          <div id="rpgSpeakZone">
            <div class="rpg-prompts-label" id="rpgPromptsLabel">SAY IT NATURALLY — OR TAP A PHRASE TO PRACTICE</div>
            <div class="rpg-prompt-chips" id="rpgPromptChips"></div>
            <div class="rpg-speak-bar">
              <button type="button" class="rpg-mic-btn" id="rpgMicBtn">🎤 Speak English</button>
              <form class="rpg-say-form" id="rpgSayForm">
                <input type="text" class="rpg-say-input" id="rpgSayInput" placeholder="Speak with mic or type your reply…" autocomplete="off" />
                <button type="submit" class="rpg-say-send">Send</button>
              </form>
            </div>
            <div class="rpg-live-transcript" id="rpgLiveTranscript" aria-live="polite"></div>
          </div>

          <div id="rpgDlgDoneRow" hidden style="margin-top:14px;display:flex;justify-content:flex-end;gap:10px">
            <button type="button" class="rpg-btn-primary" id="rpgDlgDoneBtn">Continue Exploring ✨</button>
          </div>
        </div>
      </div>

      <!-- Universal Modal (Welcome, World Map, Quests, Friends, Wardrobe, Coach, Mini-Game) -->
      <div class="rpg-modal-wrap" id="rpgModalWrap" hidden>
        <div class="rpg-modal" id="rpgModalCard" role="dialog" aria-modal="true"></div>
      </div>
    `;

    document.body.insertBefore(shell, document.body.firstChild);
    canvas = document.getElementById('vq-rpg-canvas');
    ctx = canvas.getContext && canvas.getContext('2d');
  }

  /* ==========================================================================
     THEME & MODE SYNC
     ========================================================================== */
  function applyTheme(light, persist) {
    document.documentElement.classList.toggle('light', light);
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#d3d9e3' : '#0b1220');
    const btn = document.getElementById('rpgThemeBtn');
    if (btn) btn.textContent = light ? '🌙' : '☀️';
    if (persist) safeSet('cmc-theme', light ? 'light' : 'dark');
  }

  function setMode(mode) {
    state.mode = mode === 'classic' ? 'classic' : 'rpg';
    document.body.classList.toggle('vq-mode-rpg', state.mode === 'rpg');
    document.body.classList.toggle('vq-mode-classic', state.mode === 'classic');
    saveState();
  }

  /* ==========================================================================
     HUD, TOASTS & QUEST PILL RENDERING
     ========================================================================== */
  function pushToast(title, detail) {
    const stack = document.getElementById('rpgToastStack');
    if (!stack) return;
    const t = document.createElement('div');
    t.className = 'rpg-toast';
    t.innerHTML = `${title}${detail ? `<small>${detail}</small>` : ''}`;
    stack.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 350); }, 3600);
  }

  function showZoneBanner(zone) {
    const b = document.getElementById('rpgZoneBanner');
    if (!b) return;
    b.textContent = `${zone.icon} ${zone.name} · ${zone.khmer}`;
    b.classList.add('show');
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.remove('show'), 2600);
  }

  function timePhaseLabel() {
    const t = state.timeOfDay % 1;
    if (t < 0.16) return '🌅 Dawn';
    if (t < 0.56) return '☀️ Day';
    if (t < 0.76) return '🌇 Sunset';
    return '🏮 Night';
  }
  function weatherLabel() {
    return { sunny: '🌤️ Sunny', breeze: '🌸 Breeze', rain: '🌧️ Monsoon', lanterns: '🏮 Lanterns' }[state.weather] || '🌤️ Sunny';
  }

  function renderHud() {
    const z = ZONES[state.zone] || ZONES.village;
    const req = xpForLevel(state.level);
    const pct = Math.min(100, Math.round((state.xp / req) * 100));
    const el = (id) => document.getElementById(id);
    if (el('rpgAvatarRing')) el('rpgAvatarRing').innerHTML = `${(state.player.name[0] || 'E').toUpperCase()}<span class="rpg-lvl-badge" id="rpgLvlBadge">${state.level}</span>`;
    if (el('rpgPlayerName')) el('rpgPlayerName').textContent = state.player.name;
    if (el('rpgPlayerTitle')) el('rpgPlayerTitle').textContent = currentTitle();
    if (el('rpgXpFill')) el('rpgXpFill').style.width = `${pct}%`;
    if (el('rpgZoneChip')) el('rpgZoneChip').textContent = `${z.icon} ${z.name}`;
    if (el('rpgCoins')) el('rpgCoins').textContent = String(state.coins);
    if (el('rpgStreak')) el('rpgStreak').textContent = String(state.streak);
    if (el('rpgTimeBtn')) el('rpgTimeBtn').textContent = timePhaseLabel();
    if (el('rpgWeatherBtn')) el('rpgWeatherBtn').textContent = weatherLabel();
    if (el('rpgMusicBtn')) el('rpgMusicBtn').textContent = state.musicOn ? '🎵' : '🔇';
  }

  function renderQuestPill() {
    const def = QUEST_DEFS.find((q) => q.id === state.activeQuest) || QUEST_DEFS[0];
    const progress = state.quests[def.id] || { steps: {}, done: false };
    const doneSteps = def.steps.filter((s) => progress.steps[s]).length;
    const nextStepKey = def.steps.find((s) => !progress.steps[s]);
    const el = (id) => document.getElementById(id);
    if (el('rpgQuestTitle')) el('rpgQuestTitle').textContent = def.title;
    if (el('rpgQuestStep')) el('rpgQuestStep').textContent = progress.done ? 'Quest complete! Pick another quest to explore.' : (def.stepLabels[nextStepKey] || def.desc);
    if (el('rpgQuestFill')) el('rpgQuestFill').style.width = `${Math.round((doneSteps / def.steps.length) * 100)}%`;
    if (el('rpgQuestCount')) el('rpgQuestCount').textContent = `${doneSteps}/${def.steps.length}`;
    const goBtn = el('rpgQuestGoBtn');
    if (goBtn) {
      const targetZone = ZONES[def.zone];
      goBtn.textContent = state.zone === def.zone ? '🧭 Walk to the glowing marker!' : `🧭 Travel to ${targetZone.name}`;
      goBtn.onclick = () => {
        if (state.zone !== def.zone) enterZone(def.zone);
        else {
          const npc = NPCS.find((n) => n.id === def.npc);
          if (npc) {
            playerMotion.targetX = npcRuntime[npc.id].x - 42;
            playerMotion.targetY = npcRuntime[npc.id].y + 18;
          }
        }
      };
    }
  }

  /* ==========================================================================
     ZONE TRAVEL & INTERACTIONS
     ========================================================================== */
  function enterZone(zoneId, spawnOverride) {
    const z = ZONES[zoneId];
    if (!z) return;
    state.zone = zoneId;
    const sp = spawnOverride || z.spawn;
    playerMotion.x = sp.x;
    playerMotion.y = sp.y;
    playerMotion.targetX = null;
    playerMotion.targetY = null;
    petMotion.x = sp.x - 32;
    petMotion.y = sp.y + 14;
    if (zoneId === 'secret') {
      markQuestStep(state, 'q_secret', 'enter');
      unlockAchievement('secret_finder', 'Secret Explorer', 'Found the Hidden Lotus Sanctuary!');
    }
    if (zoneId === 'festival' && state.timeOfDay < 0.65) {
      state.timeOfDay = 0.78;
      state.weather = 'lanterns';
    }
    saveState();
    renderHud();
    renderQuestPill();
    showZoneBanner(z);
    SFX.softTap();
  }

  function findNearbyTarget() {
    const z = ZONES[state.zone];
    if (!z) return null;
    let best = null;
    let bestDist = 96;

    for (const n of NPCS) {
      if (n.zone !== state.zone) continue;
      const rt = npcRuntime[n.id];
      const d = Math.hypot(rt.x - playerMotion.x, rt.y - playerMotion.y);
      if (d < bestDist) {
        bestDist = d;
        best = { kind: 'npc', npc: n, label: `Talk to ${n.name}` };
      }
    }
    for (const p of z.props) {
      if (p.type === 'collectible' && !state.collectibles.includes(p.id)) {
        const d = Math.hypot(p.x - playerMotion.x, p.y - playerMotion.y);
        if (d < 78) return { kind: 'collectible', prop: p, label: `Collect ${p.label}` };
      }
      if (p.type === 'wishLantern' && !state.litLanterns.includes(p.id)) {
        const d = Math.hypot(p.x - playerMotion.x, p.y - playerMotion.y);
        if (d < 84) return { kind: 'wishLantern', prop: p, label: `Speak a Wish & Light Lantern` };
      }
      if (p.type === 'board') {
        const d = Math.hypot(p.x - playerMotion.x, p.y - playerMotion.y);
        if (d < 84 && !best) best = { kind: 'board', prop: p, label: `Read ${p.title}` };
      }
      if (p.type === 'minigame') {
        const d = Math.hypot(p.x - playerMotion.x, p.y - playerMotion.y);
        if (d < 92) return { kind: 'minigame', prop: p, label: `Play ${p.title}` };
      }
    }
    for (const g of z.gates) {
      const d = Math.hypot(g.x - playerMotion.x, g.y - playerMotion.y);
      if (d < 74) return { kind: 'gate', gate: g, label: g.label };
    }
    return best;
  }

  function triggerInteraction(target) {
    if (!target) return;
    SFX.init();
    SFX.startMusic();
    if (target.kind === 'npc') {
      openDialogue(target.npc);
    } else if (target.kind === 'gate') {
      enterZone(target.gate.to);
    } else if (target.kind === 'collectible') {
      state.collectibles.push(target.prop.id);
      SFX.coin();
      awardRewards(20, 15, target.prop.x, target.prop.y);
      pushToast(`${target.prop.icon} Found ${target.prop.label}!`, `${state.collectibles.length} / 8 world treasures collected`);
      if (state.collectibles.length >= 3) unlockAchievement('collector', 'Treasure Seeker', 'Collected 3 Cambodian world treasures!');
    } else if (target.kind === 'board') {
      pushToast(`🪧 ${target.prop.title}`, target.prop.msg);
      speakNpc(target.prop.msg, null, false);
    } else if (target.kind === 'wishLantern') {
      state.litLanterns.push(target.prop.id);
      SFX.chime();
      spawnBurst(target.prop.x, target.prop.y - 20, '#fbbf24', 28);
      awardRewards(25, 15, target.prop.x, target.prop.y);
      markQuestStep(state, 'q_festival', 'lantern');
      pushToast(`🏮 ${target.prop.label} Lit!`, 'Your glowing wish floated into the night sky!');
    } else if (target.kind === 'minigame') {
      openMiniGame();
    }
  }

  /* ==========================================================================
     DYNAMIC MULTI-TURN NPC DIALOGUE + LIVE PRONUNCIATION COACH
     ========================================================================== */
  const EMOTION_BADGES = {
    happy: '😊 Happy', excited: '🤩 Excited', curious: '🤔 Curious',
    thoughtful: '😌 Thoughtful', proud: '🌟 Proud', shy: '🥺 Shy', grateful: '💛 Grateful',
  };

  function openDialogue(npc, nodeKey) {
    activeDlg = { npc, nodeKey: nodeKey || 'start' };
    playerMotion.targetX = null;
    playerMotion.targetY = null;
    playerMotion.wave = 0.8;
    const rt = npcRuntime[npc.id];
    if (rt) rt.facing = playerMotion.x < rt.x ? -1 : 1;

    renderDialogueNode();
    document.getElementById('rpgDlgWrap').hidden = false;
  }

  function closeDialogue() {
    stopSpeechRec();
    if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch {} }
    activeDlg = null;
    document.getElementById('rpgDlgWrap').hidden = true;
  }

  function renderDialogueNode() {
    if (!activeDlg) return;
    const { npc, nodeKey } = activeDlg;
    const node = npc.dialogue[nodeKey] || npc.dialogue.start;
    const speechText = typeof node.npc === 'function' ? node.npc(state) : node.npc;
    const hearts = Math.min(5, state.hearts[npc.id] || 0);

    document.getElementById('rpgPortraitImg').src = npc.portrait;
    document.getElementById('rpgNpcName').textContent = npc.name;
    document.getElementById('rpgNpcRole').textContent = npc.role;
    document.getElementById('rpgEmotionTag').textContent = EMOTION_BADGES[node.emotion || 'happy'] || '😊 Happy';
    document.getElementById('rpgNpcHearts').textContent = '❤️'.repeat(hearts) + '🤍'.repeat(5 - hearts);
    document.getElementById('rpgNpcSpeech').textContent = speechText;
    document.getElementById('rpgLevelBtn').textContent = `🎯 Level: ${state.levelDiff}`;
    document.getElementById('rpgLiveTranscript').textContent = '';

    const memEl = document.getElementById('rpgMemoryNote');
    const memNotes = [];
    if (state.memory.favFruit && npc.id === 'maly') memNotes.push(`Remembers your favorite: ${state.memory.favFruit}`);
    if (state.memory.mood && npc.id === 'dara') memNotes.push(`Remembers your mood: ${state.memory.mood}`);
    if (state.memory.favPlace && npc.id === 'rithy') memNotes.push(`Remembers your route: ${state.memory.favPlace}`);
    memEl.textContent = memNotes.length ? `💭 ${memNotes.join(' · ')}` : '';

    const fb = document.getElementById('rpgFeedbackBox');
    fb.classList.remove('show', 'retry');

    const speakZone = document.getElementById('rpgSpeakZone');
    const doneRow = document.getElementById('rpgDlgDoneRow');

    if (node.end) {
      speakZone.hidden = true;
      doneRow.hidden = false;
    } else {
      speakZone.hidden = false;
      doneRow.hidden = true;
      const prompts = (node.prompts && (node.prompts[state.levelDiff] || node.prompts.A1)) || [];
      const chipsWrap = document.getElementById('rpgPromptChips');
      chipsWrap.innerHTML = '';
      prompts.forEach((p) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'rpg-prompt-chip';
        b.textContent = `“${p}”`;
        b.title = 'Click to fill or practice speaking this phrase';
        b.addEventListener('click', () => {
          document.getElementById('rpgSayInput').value = p;
          speakNpc(p, null, false);
        });
        chipsWrap.appendChild(b);
      });
      document.getElementById('rpgSayInput').value = '';
    }

    if (npcRuntime[npc.id]) npcRuntime[npc.id].emotion = node.emotion || 'happy';
    speakNpc(speechText, npc, false);
  }

  function handlePlayerReply(spokenText, rawConfidence) {
    if (!activeDlg) return;
    const text = String(spokenText || '').trim();
    if (!text) return;
    const { npc, nodeKey } = activeDlg;
    const node = npc.dialogue[nodeKey];
    if (!node || node.end) return;

    const prompts = (node.prompts && (node.prompts[state.levelDiff] || node.prompts.A1)) || [];
    const evalRes = evaluateSpeech(text, node.keywords || [], prompts, rawConfidence);

    // Record SRS & stats
    state.totalSpoken++;
    state.scoreSamples++;
    state.avgScore = Math.round(((state.avgScore * (state.scoreSamples - 1)) + evalRes.score) / state.scoreSamples);
    const keyPhrase = prompts[0] || text.slice(0, 48);
    const prevSrs = state.srs[keyPhrase] || { count: 0, best: 0, last: 0 };
    state.srs[keyPhrase] = { count: prevSrs.count + 1, best: Math.max(prevSrs.best, evalRes.score), last: Date.now() };

    // Show immediate visual pronunciation feedback
    const fb = document.getElementById('rpgFeedbackBox');
    const summary = document.getElementById('rpgFbSummary');
    const wordsWrap = document.getElementById('rpgFbWords');
    fb.classList.add('show');
    fb.classList.toggle('retry', !evalRes.pass);

    const xpEarned = evalRes.pass ? (evalRes.score >= 90 ? 18 : 12) : 4;
    const coinsEarned = evalRes.pass ? 10 : 2;
    summary.innerHTML = evalRes.pass
      ? `<span>✅ Great pronunciation!</span><span>⭐ +${xpEarned} XP · 🪙 +${coinsEarned} · 🎤 Pronunciation Score: ${evalRes.score}%</span>`
      : `<span>💡 Almost there — tap any yellow word to hear it!</span><span>🎤 Pronunciation Score: ${evalRes.score}%</span>`;

    wordsWrap.innerHTML = '';
    evalRes.tokens.forEach((tok) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `rpg-word-pill ${tok.status}`;
      pill.textContent = tok.suggestion ? `${tok.raw} → ${tok.suggestion}` : tok.raw;
      pill.title = 'Tap to hear pronunciation';
      pill.addEventListener('click', () => speakNpc(tok.suggestion || tok.raw, null, true));
      wordsWrap.appendChild(pill);
    });

    if (evalRes.pass) {
      SFX.chime();
      state.hearts[npc.id] = Math.min(5, (state.hearts[npc.id] || 0) + 1);
      const rt = npcRuntime[npc.id];
      if (rt) {
        rt.celebrate = 1.0;
        spawnPopup(rt.x, rt.y - 46, '❤️ +1 Friend', '#fb7185');
      }
      playerMotion.celebrate = 0.85;
      awardRewards(xpEarned, coinsEarned, playerMotion.x, playerMotion.y);
      if (state.totalSpoken === 1) unlockAchievement('first_words', 'First Voice!', 'Spoke your first English reply in Cambodia!');
      if (state.totalSpoken >= 10) unlockAchievement('chatterbox', 'Confident Speaker', 'Completed 10 spoken English turns!');
      if (evalRes.score >= 95) unlockAchievement('crystal_voice', 'Crystal Pronunciation', 'Scored 95%+ on a spoken English phrase!');

      // Adaptive difficulty nudge
      if (state.scoreSamples >= 6 && state.avgScore >= 92 && state.levelDiff === 'A1') {
        state.levelDiff = 'A2';
        pushToast('📈 Adaptive Coach: Level A2 Unlocked!', 'Your pronunciation is shining — prompts stepped up to Explorer A2.');
      }

      if (typeof node.onComplete === 'function') node.onComplete(state);
      const nextKey = typeof node.next === 'function' ? node.next(text, state) : 'wrap';
      saveState();

      setTimeout(() => {
        if (!activeDlg || activeDlg.npc.id !== npc.id) return;
        activeDlg.nodeKey = nextKey;
        renderDialogueNode();
        // Keep the feedback summary visible for the new reply!
        const nextFb = document.getElementById('rpgFeedbackBox');
        if (nextFb) nextFb.classList.add('show');
      }, 1150);
    } else {
      SFX.softTap();
      saveState();
    }
  }

  /* ── Web Speech Recognition (Live Mic for Dialogue & World Voice Navigation!) ── */
  function stopSpeechRec() {
    if (activeSpeechRec) {
      try { activeSpeechRec.abort(); } catch {}
      activeSpeechRec = null;
    }
    const mb = document.getElementById('rpgMicBtn');
    if (mb) { mb.classList.remove('listening'); mb.textContent = '🎤 Speak English'; }
    const wb = document.getElementById('rpgWorldMicBtn');
    if (wb) { wb.classList.remove('listening'); wb.textContent = '🎤 Speak Command'; }
  }

  function startSpeechRec(mode) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      if (mode === 'dialogue') {
        document.getElementById('rpgLiveTranscript').textContent = 'Voice mic unavailable in this browser — type your reply or tap a phrase chip!';
        document.getElementById('rpgSayInput').focus();
      } else {
        pushToast('🎤 Voice Mic Unavailable', 'Tap anywhere on the map to walk, or tap NPCs directly!');
      }
      return;
    }
    stopSpeechRec();
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    activeSpeechRec = rec;

    if (mode === 'dialogue') {
      const mb = document.getElementById('rpgMicBtn');
      mb.classList.add('listening');
      mb.textContent = '🎙️ Listening…';
      document.getElementById('rpgLiveTranscript').textContent = 'Listening — speak naturally…';
    } else {
      const wb = document.getElementById('rpgWorldMicBtn');
      wb.classList.add('listening');
      wb.textContent = '🎙️ Say a place or action…';
    }

    rec.onresult = (ev) => {
      let interim = '';
      let finalTxt = '';
      let conf = 0.9;
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) { finalTxt += res[0].transcript; conf = res[0].confidence || 0.9; }
        else interim += res[0].transcript;
      }
      if (mode === 'dialogue') {
        document.getElementById('rpgLiveTranscript').textContent = `🎤 Heard: “${(finalTxt || interim).trim()}”`;
        if (finalTxt.trim()) {
          stopSpeechRec();
          document.getElementById('rpgSayInput').value = finalTxt.trim();
          handlePlayerReply(finalTxt.trim(), conf);
        }
      } else if (finalTxt.trim()) {
        stopSpeechRec();
        handleWorldVoiceCommand(finalTxt.trim());
      }
    };
    rec.onerror = () => stopSpeechRec();
    rec.onend = () => stopSpeechRec();
    try { rec.start(); } catch { stopSpeechRec(); }
  }

  function handleWorldVoiceCommand(cmd) {
    const c = cmd.toLowerCase();
    pushToast(`🎤 Voice Command: “${cmd}”`, 'Carrying out your action!');
    if (/market|mango|coffee|maly/.test(c)) { enterZone('market'); return; }
    if (/school|teacher|leakhena|sopheak/.test(c)) { enterZone('school'); return; }
    if (/temple|wat|vanna|elder/.test(c)) { enterZone('temple'); return; }
    if (/park|river|mekong|bopha/.test(c)) { enterZone('park'); return; }
    if (/festival|lantern|channary/.test(c)) { enterZone('festival'); return; }
    if (/tuk|bus|hub|rithy/.test(c)) { enterZone('transit'); return; }
    if (/village|home|lotus|dara/.test(c)) { enterZone('village'); return; }
    if (/secret|sanctuary|arun/.test(c)) { enterZone('secret'); return; }
    if (/talk|hello|hi|speak/.test(c)) {
      const npc = NPCS.find((n) => n.zone === state.zone);
      if (npc) openDialogue(npc);
      return;
    }
    if (/north|up/.test(c)) playerMotion.targetY = Math.max(80, playerMotion.y - 140);
    else if (/south|down/.test(c)) playerMotion.targetY = Math.min(WORLD_H - 80, playerMotion.y + 140);
    else if (/east|right/.test(c)) playerMotion.targetX = Math.min(WORLD_W - 80, playerMotion.x + 160);
    else if (/west|left/.test(c)) playerMotion.targetX = Math.max(80, playerMotion.x - 160);
  }

  /* ==========================================================================
     MODALS: WELCOME, WORLD MAP, QUESTS, FRIENDS, WARDROBE & PETS, COACH, MINI-GAME
     ========================================================================== */
  function openModal(html) {
    const wrap = document.getElementById('rpgModalWrap');
    const card = document.getElementById('rpgModalCard');
    card.innerHTML = html;
    wrap.hidden = false;
  }
  function closeModal() {
    activeMini = null;
    document.getElementById('rpgModalWrap').hidden = true;
  }

  function openWelcomeModal() {
    openModal(`
      <div class="rpg-welcome-hero">
        <img src="./images/voice-quest-rpg/world-banner.jpg" alt="Modern Cambodian lakeside community with stilt houses, lotus pond, market and tuk-tuk" />
        <span class="eyebrow">Talk to me · Adventure World RPG</span>
        <h1>Srok Speak · Cambodia</h1>
        <p>Explore a living modern Cambodian world — stilt-house villages, schools, markets, temples, Mekong Park, and Water Festival lanterns. Speak real English with expressive local friends to progress!</p>
      </div>
      <div class="rpg-modal-body">
        <div class="rpg-grid-3" style="margin-bottom:16px">
          <div class="rpg-card"><strong>🚶 Living World</strong><span style="font-size:12.5px;color:var(--rpg-soft)">Walk smoothly anywhere with WASD, Arrow keys, tap-to-walk, or voice commands across 8 zones.</span></div>
          <div class="rpg-card"><strong>🎤 Live Voice Coach</strong><span style="font-size:12.5px;color:var(--rpg-soft)">Real-time speech recognition with word-by-word pronunciation highlights, XP popups &amp; typing fallback.</span></div>
          <div class="rpg-card"><strong>💛 Dynamic NPCs &amp; Pets</strong><span style="font-size:12.5px;color:var(--rpg-soft)">Characters remember your chats, show emotions, and unlock pets, titles, outfits &amp; hidden quests!</span></div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">
          <label style="font-size:13px;font-weight:700">Your Explorer Name:
            <input id="rpgWelcomeName" class="rpg-say-input" style="margin-left:8px;min-height:40px;width:190px" maxlength="20" value="${escapeHtml(state.player.name)}" />
          </label>
          <label style="font-size:13px;font-weight:700">Speaking Level:
            <select id="rpgWelcomeLevel" class="rpg-say-input" style="margin-left:8px;min-height:40px">
              <option value="A1" ${state.levelDiff === 'A1' ? 'selected' : ''}>Beginner (A1)</option>
              <option value="A2" ${state.levelDiff === 'A2' ? 'selected' : ''}>Explorer (A2)</option>
              <option value="B1" ${state.levelDiff === 'B1' ? 'selected' : ''}>Confident (B1)</option>
            </select>
          </label>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <button type="button" class="rpg-btn-primary" id="rpgStartBtn">🌏 Enter Phum Lotus Village</button>
          <button type="button" class="rpg-btn-ghost" id="rpgSwitchClassicWelcome">📚 Open Classic 15-Level Lab</button>
        </div>
      </div>
    `);
    document.getElementById('rpgStartBtn').addEventListener('click', () => {
      const nm = document.getElementById('rpgWelcomeName').value.trim();
      if (nm) state.player.name = nm.slice(0, 20);
      state.levelDiff = document.getElementById('rpgWelcomeLevel').value;
      state.welcomed = true;
      SFX.init();
      SFX.startMusic();
      SFX.chime();
      saveState();
      renderHud();
      renderQuestPill();
      closeModal();
      showZoneBanner(ZONES[state.zone]);
    });
    document.getElementById('rpgSwitchClassicWelcome').addEventListener('click', () => {
      state.welcomed = true;
      closeModal();
      setMode('classic');
    });
  }

  function openWorldMap() {
    const cards = Object.values(ZONES).map((z) => {
      const lockedSecret = z.id === 'secret' && !state.quests.q_secret?.steps?.enter && !state.quests.q_elder?.done;
      const npcsHere = NPCS.filter((n) => n.zone === z.id).map((n) => n.name).join(', ');
      return `
        <button type="button" class="rpg-card clickable ${state.zone === z.id ? 'active' : ''}" data-go-zone="${z.id}" style="text-align:left">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong style="font-size:15px">${z.icon} ${z.name}</strong>
            <span style="font-size:11px;color:var(--rpg-cyan);font-weight:800">${state.zone === z.id ? 'HERE' : (lockedSecret ? 'SECRET' : 'TRAVEL')}</span>
          </div>
          <span style="font-size:11.5px;color:var(--rpg-gold);font-weight:700">${z.khmer}</span>
          <span style="font-size:12px;color:var(--rpg-soft)">${z.subtitle}</span>
          <span style="font-size:11px;color:var(--rpg-mute)">Friends here: ${npcsHere || 'Explore!'}</span>
        </button>`;
    }).join('');
    openModal(`
      <div class="rpg-modal-head"><h2>🗺️ Modern Cambodia World Map</h2><button type="button" class="rpg-dlg-close" id="rpgModalClose">✕</button></div>
      <div class="rpg-modal-body"><div class="rpg-grid-2">${cards}</div></div>
    `);
    document.getElementById('rpgModalClose').onclick = closeModal;
    document.querySelectorAll('[data-go-zone]').forEach((b) => {
      b.addEventListener('click', () => {
        enterZone(b.getAttribute('data-go-zone'));
        closeModal();
      });
    });
  }

  function openQuestsModal() {
    const cards = QUEST_DEFS.map((q) => {
      const st = state.quests[q.id] || { steps: {}, done: false };
      const doneCount = q.steps.filter((s) => st.steps[s]).length;
      const stepsHtml = q.steps.map((s) => `<div style="font-size:12px;color:${st.steps[s] ? 'var(--rpg-mint)' : 'var(--rpg-soft)'}">${st.steps[s] ? '✅' : '○'} ${q.stepLabels[s]}</div>`).join('');
      return `
        <div class="rpg-card ${state.activeQuest === q.id ? 'active' : ''}">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <strong>${q.hidden ? '✨ ' : ''}${q.title}</strong>
            <span style="font-size:11px;font-weight:800;color:${st.done ? 'var(--rpg-mint)' : 'var(--rpg-gold)'}">${st.done ? 'COMPLETED' : `${doneCount}/${q.steps.length}`}</span>
          </div>
          <p style="font-size:12px;color:var(--rpg-soft)">${q.desc}</p>
          ${stepsHtml}
          <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--rpg-cyan)">
            <span>Reward: +${q.rewardXp} XP · +${q.rewardCoins} 🪙 · 🏅 ${q.badge}</span>
            ${st.done ? '' : `<button type="button" class="rpg-mini-btn" data-track-quest="${q.id}">Track &amp; Go</button>`}
          </div>
        </div>`;
    }).join('');
    openModal(`
      <div class="rpg-modal-head"><h2>📜 Community Speaking Quests</h2><button type="button" class="rpg-dlg-close" id="rpgModalClose">✕</button></div>
      <div class="rpg-modal-body"><div class="rpg-grid-2">${cards}</div></div>
    `);
    document.getElementById('rpgModalClose').onclick = closeModal;
    document.querySelectorAll('[data-track-quest]').forEach((b) => {
      b.addEventListener('click', () => {
        const qid = b.getAttribute('data-track-quest');
        const def = QUEST_DEFS.find((d) => d.id === qid);
        state.activeQuest = qid;
        saveState();
        renderQuestPill();
        if (def && def.zone !== state.zone) enterZone(def.zone);
        closeModal();
      });
    });
  }

  function openFriendsModal() {
    const cards = NPCS.map((n) => {
      const h = Math.min(5, state.hearts[n.id] || 0);
      return `
        <div class="rpg-card">
          <div class="rpg-npc-row">
            <img src="${n.portrait}" alt="${n.name}" />
            <div>
              <strong style="font-size:15px">${n.name}</strong>
              <div style="font-size:11.5px;color:var(--rpg-cyan);font-weight:700">${n.role} · ${ZONES[n.zone].name}</div>
              <div style="font-size:13px;margin-top:2px">${'❤️'.repeat(h)}${'🤍'.repeat(5 - h)}</div>
            </div>
          </div>
          <p style="font-size:12px;color:var(--rpg-soft)">${n.bio}</p>
          <button type="button" class="rpg-mini-btn" style="align-self:flex-start" data-visit-npc="${n.id}">Visit ${n.name}</button>
        </div>`;
    }).join('');
    openModal(`
      <div class="rpg-modal-head"><h2>💛 Community Friends &amp; Relationships</h2><button type="button" class="rpg-dlg-close" id="rpgModalClose">✕</button></div>
      <div class="rpg-modal-body"><div class="rpg-grid-2">${cards}</div></div>
    `);
    document.getElementById('rpgModalClose').onclick = closeModal;
    document.querySelectorAll('[data-visit-npc]').forEach((b) => {
      b.addEventListener('click', () => {
        const n = NPCS.find((x) => x.id === b.getAttribute('data-visit-npc'));
        if (n) {
          enterZone(n.zone, { x: n.x - 45, y: n.y + 18 });
          closeModal();
          setTimeout(() => openDialogue(n), 220);
        }
      });
    });
  }

  function openWardrobeModal() {
    const outfitHtml = OUTFITS.map((o) => `
      <button type="button" class="rpg-card clickable ${state.player.outfit === o.id ? 'active' : ''}" data-outfit="${o.id}" style="text-align:left">
        <strong><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${o.body};margin-right:6px"></span>${o.name}</strong>
        <span style="font-size:12px;color:var(--rpg-soft)">${o.desc}</span>
      </button>`).join('');
    const accHtml = ACCESSORIES.map((a) => `
      <button type="button" class="rpg-mini-btn ${state.player.accessory === a.id ? 'active' : ''}" data-acc="${a.id}">${a.name}</button>`).join('');
    const petHtml = PETS.map((p) => {
      const owned = state.player.unlockedPets.includes(p.id);
      const active = state.player.pet === p.id;
      return `
        <button type="button" class="rpg-card clickable ${active ? 'active' : ''}" data-pet="${p.id}" style="text-align:left">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong>${p.icon} ${p.name}</strong>
            <span style="font-size:11px;font-weight:800;color:${active ? 'var(--rpg-mint)' : 'var(--rpg-gold)'}">${active ? 'FOLLOWING' : (owned ? 'EQUIP' : `🪙 ${p.cost}`)}</span>
          </div>
          <span style="font-size:12px;color:var(--rpg-soft)">${p.desc}</span>
        </button>`;
    }).join('');
    openModal(`
      <div class="rpg-modal-head"><h2>🎒 Explorer Wardrobe &amp; Pet Companions (🪙 ${state.coins})</h2><button type="button" class="rpg-dlg-close" id="rpgModalClose">✕</button></div>
      <div class="rpg-modal-body">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
          <strong style="font-size:13px">Name:</strong>
          <input id="rpgWardrobeName" class="rpg-say-input" style="min-height:38px;max-width:190px" maxlength="20" value="${escapeHtml(state.player.name)}" />
          <strong style="font-size:13px;margin-left:8px">Accessory:</strong> ${accHtml}
        </div>
        <h3 style="font-size:13px;letter-spacing:0.1em;text-transform:uppercase;color:var(--rpg-cyan);margin-bottom:8px">Outfits</h3>
        <div class="rpg-grid-2" style="margin-bottom:16px">${outfitHtml}</div>
        <h3 style="font-size:13px;letter-spacing:0.1em;text-transform:uppercase;color:var(--rpg-gold);margin-bottom:8px">Adoptable Pet Companions</h3>
        <div class="rpg-grid-2">${petHtml}</div>
      </div>
    `);
    document.getElementById('rpgModalClose').onclick = closeModal;
    document.getElementById('rpgWardrobeName').addEventListener('change', (e) => {
      const v = e.target.value.trim();
      if (v) { state.player.name = v.slice(0, 20); saveState(); renderHud(); }
    });
    document.querySelectorAll('[data-outfit]').forEach((b) => {
      b.onclick = () => { state.player.outfit = b.getAttribute('data-outfit'); SFX.softTap(); saveState(); openWardrobeModal(); };
    });
    document.querySelectorAll('[data-acc]').forEach((b) => {
      b.onclick = () => { state.player.accessory = b.getAttribute('data-acc'); SFX.softTap(); saveState(); openWardrobeModal(); };
    });
    document.querySelectorAll('[data-pet]').forEach((b) => {
      b.onclick = () => {
        const pid = b.getAttribute('data-pet');
        const pet = PETS.find((x) => x.id === pid);
        if (!pet) return;
        if (!state.player.unlockedPets.includes(pid)) {
          if (state.coins < pet.cost) { pushToast('🪙 Not enough coins yet!', 'Speak with friends or play Market Rush to earn more coins.'); return; }
          state.coins -= pet.cost;
          state.player.unlockedPets.push(pid);
          SFX.fanfare();
          pushToast(`${pet.icon} Adopted ${pet.name}!`, 'Your new friend now follows you across Cambodia!');
        }
        state.player.pet = pid;
        saveState();
        renderHud();
        openWardrobeModal();
      };
    });
  }

  function openCoachModal() {
    const today = new Date().toISOString().slice(0, 10);
    const dailyIdx = Math.abs(today.split('-').reduce((a, b) => a + Number(b), 0)) % DAILY_CHALLENGES.length;
    const daily = DAILY_CHALLENGES[dailyIdx];
    const dailyDone = state.dailyDoneDay === today;
    const completedQuests = QUEST_DEFS.filter((q) => state.quests[q.id]?.done).length;
    const srsItems = Object.entries(state.srs).slice(0, 8).map(([phrase, info]) => `
      <div class="rpg-card" style="padding:10px 12px">
        <strong style="font-size:13px">“${escapeHtml(phrase)}”</strong>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--rpg-soft)">
          <span>Practiced ${info.count}× · Best: <strong style="color:var(--rpg-mint)">${info.best}%</strong></span>
          <button type="button" class="rpg-mini-btn" data-hear-srs="${escapeHtml(phrase)}">🔊 Hear</button>
        </div>
      </div>`).join('') || '<p style="font-size:13px;color:var(--rpg-soft)">Speak with villagers to build your personalized spaced-repetition phrase book!</p>';

    openModal(`
      <div class="rpg-modal-head"><h2>📊 Speaking Coach &amp; Daily Challenge</h2><button type="button" class="rpg-dlg-close" id="rpgModalClose">✕</button></div>
      <div class="rpg-modal-body">
        <div class="rpg-grid-3" style="margin-bottom:16px">
          <div class="rpg-card"><strong style="font-size:22px;color:var(--rpg-cyan)">${state.avgScore || 0}%</strong><span style="font-size:11.5px;color:var(--rpg-soft)">Avg Pronunciation Score</span></div>
          <div class="rpg-card"><strong style="font-size:22px;color:var(--rpg-mint)">${state.totalSpoken}</strong><span style="font-size:11.5px;color:var(--rpg-soft)">Spoken English Turns</span></div>
          <div class="rpg-card"><strong style="font-size:22px;color:var(--rpg-gold)">${completedQuests}/${QUEST_DEFS.length}</strong><span style="font-size:11.5px;color:var(--rpg-soft)">Community Quests Done</span></div>
        </div>

        <div class="rpg-card active" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
            <strong>🔥 Daily Speaking Challenge (${daily.tip})</strong>
            <span style="font-size:11px;font-weight:800;color:${dailyDone ? 'var(--rpg-mint)' : 'var(--rpg-gold)'}">${dailyDone ? 'COMPLETED TODAY ✅' : '+40 XP · +30 🪙'}</span>
          </div>
          <p style="font-size:15px;font-weight:700;margin-top:4px">“${daily.prompt}”</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
            <button type="button" class="rpg-mini-btn" id="rpgDailyHear">🔊 Listen Model</button>
            <input id="rpgDailyIn" class="rpg-say-input" style="min-height:38px;flex:1" placeholder="Type or speak today’s challenge…" />
            <button type="button" class="rpg-btn-primary" style="min-height:38px;padding:0 16px;font-size:13px" id="rpgDailySubmit">Check &amp; Claim</button>
          </div>
          <div id="rpgDailyMsg" style="font-size:12px;font-weight:700;color:var(--rpg-mint)"></div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
          <h3 style="font-size:13px;letter-spacing:0.1em;text-transform:uppercase;color:var(--rpg-cyan)">Spaced Repetition Phrase Book</h3>
          <button type="button" class="rpg-mini-btn" id="rpgPostLbBtn">🏆 Post Progress to CMC Class Leaderboard</button>
        </div>
        <div class="rpg-grid-2">${srsItems}</div>
      </div>
    `);
    document.getElementById('rpgModalClose').onclick = closeModal;
    document.getElementById('rpgDailyHear').onclick = () => speakNpc(daily.prompt, null, false);
    document.getElementById('rpgDailySubmit').onclick = () => {
      const val = document.getElementById('rpgDailyIn').value.trim();
      const res = evaluateSpeech(val, daily.prompt.split(/\s+/), [daily.prompt], 0.92);
      const msg = document.getElementById('rpgDailyMsg');
      if (res.pass) {
        if (!dailyDone) {
          state.dailyDoneDay = today;
          state.streak++;
          awardRewards(40, 30, playerMotion.x, playerMotion.y);
        }
        SFX.fanfare();
        msg.textContent = `✅ Great pronunciation! Score: ${res.score}% — Streak: ${state.streak} days!`;
      } else {
        msg.textContent = 'Try saying or typing the phrase above clearly!';
      }
    };
    document.getElementById('rpgPostLbBtn').onclick = async () => {
      const ok = await postRpgToLeaderboard(`Lv.${state.level} ${currentTitle()}`);
      pushToast(ok ? '🏆 Posted to CMC Class Leaderboard!' : 'Saved locally!', ok ? 'Your score is live on Creative Minds.' : 'Sign in or check connection to sync.');
    };
    document.querySelectorAll('[data-hear-srs]').forEach((b) => {
      b.onclick = () => speakNpc(b.getAttribute('data-hear-srs'), null, true);
    });
  }

  /* ── Mini-Game: Market Quick-Order Rush ── */
  const MINI_ROUNDS = [
    { item: '🥭 Sweet Mango', prompt: 'I would like two sweet mangoes, please.', keys: ['mango', 'mangoes', 'two', 'please'] },
    { item: '🧋 Khmer Iced Coffee', prompt: 'Can I have one iced coffee with milk?', keys: ['iced', 'coffee', 'milk', 'one'] },
    { item: '🥥 Fresh Coconut', prompt: 'How much is this fresh coconut?', keys: ['how', 'much', 'coconut', 'fresh'] },
    { item: '🧣 Red Krama Scarf', prompt: 'Thank you very much! Have a nice day!', keys: ['thank', 'thanks', 'nice', 'day'] },
  ];
  function openMiniGame() {
    activeMini = { idx: 0, score: 0 };
    renderMiniRound();
  }
  function renderMiniRound() {
    if (!activeMini) return;
    const r = MINI_ROUNDS[activeMini.idx];
    if (!r) {
      SFX.fanfare();
      awardRewards(45, 35, playerMotion.x, playerMotion.y);
      unlockAchievement('market_rush', 'Market Speed Star', 'Completed Market Quick-Order Rush!');
      openModal(`
        <div class="rpg-modal-head"><h2>🥭 Market Quick-Order Rush Complete!</h2><button type="button" class="rpg-dlg-close" id="rpgModalClose">✕</button></div>
        <div class="rpg-modal-body" style="text-align:center">
          <p style="font-size:18px;font-weight:800;margin-bottom:10px">Average Accuracy: ${Math.round(activeMini.score / MINI_ROUNDS.length)}% · +45 XP · +35 🪙</p>
          <button type="button" class="rpg-btn-primary" id="rpgMiniDone">Back to Phsar Market</button>
        </div>
      `);
      document.getElementById('rpgModalClose').onclick = closeModal;
      document.getElementById('rpgMiniDone').onclick = closeModal;
      return;
    }
    openModal(`
      <div class="rpg-modal-head"><h2>🥭 Market Quick-Order Rush · Round ${activeMini.idx + 1}/4</h2><button type="button" class="rpg-dlg-close" id="rpgModalClose">✕</button></div>
      <div class="rpg-modal-body">
        <div class="rpg-card active" style="margin-bottom:14px">
          <span style="font-size:12px;color:var(--rpg-gold);font-weight:800">ORDER THIS ITEM: ${r.item}</span>
          <strong style="font-size:18px">“${r.prompt}”</strong>
          <div><button type="button" class="rpg-mini-btn" id="rpgMiniHear">🔊 Hear Phrase</button></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="rpgMiniIn" class="rpg-say-input" placeholder="Type or speak the order…" />
          <button type="button" class="rpg-btn-primary" id="rpgMiniGo">Serve Order ✨</button>
        </div>
      </div>
    `);
    document.getElementById('rpgModalClose').onclick = closeModal;
    document.getElementById('rpgMiniHear').onclick = () => speakNpc(r.prompt, null, false);
    document.getElementById('rpgMiniGo').onclick = () => {
      const val = document.getElementById('rpgMiniIn').value.trim() || r.prompt;
      const ev = evaluateSpeech(val, r.keys, [r.prompt], 0.92);
      activeMini.score += ev.score;
      activeMini.idx++;
      SFX.coin();
      renderMiniRound();
    };
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ==========================================================================
     60-FPS CANVAS LIVING WORLD RENDERER
     ========================================================================== */
  function updateWorld(dt) {
    if (state.mode !== 'rpg') return;
    const z = ZONES[state.zone] || ZONES.village;

    // Gentle day/night drift (1 full day ~ 6 min)
    state.timeOfDay = (state.timeOfDay + dt * 0.0028) % 1;

    // Player movement (WASD / Arrows / Tap-to-walk)
    let dx = 0, dy = 0;
    if (!activeDlg && document.getElementById('rpgModalWrap').hidden) {
      if (keys.ArrowUp || keys.KeyW || keys._up) dy -= 1;
      if (keys.ArrowDown || keys.KeyS || keys._down) dy += 1;
      if (keys.ArrowLeft || keys.KeyA || keys._left) dx -= 1;
      if (keys.ArrowRight || keys.KeyD || keys._right) dx += 1;
    }
    const speed = 215;
    if (dx || dy) {
      playerMotion.targetX = null;
      playerMotion.targetY = null;
      const len = Math.hypot(dx, dy) || 1;
      playerMotion.vx = (dx / len) * speed;
      playerMotion.vy = (dy / len) * speed;
    } else if (playerMotion.targetX !== null && playerMotion.targetY !== null) {
      const tx = playerMotion.targetX - playerMotion.x;
      const ty = playerMotion.targetY - playerMotion.y;
      const dist = Math.hypot(tx, ty);
      if (dist < 10) {
        playerMotion.targetX = null;
        playerMotion.targetY = null;
        playerMotion.vx = 0;
        playerMotion.vy = 0;
      } else {
        playerMotion.vx = (tx / dist) * speed;
        playerMotion.vy = (ty / dist) * speed;
      }
    } else {
      playerMotion.vx *= 0.72;
      playerMotion.vy *= 0.72;
    }

    playerMotion.x = Math.max(46, Math.min(WORLD_W - 46, playerMotion.x + playerMotion.vx * dt));
    playerMotion.y = Math.max(76, Math.min(WORLD_H - 46, playerMotion.y + playerMotion.vy * dt));
    const moving = Math.hypot(playerMotion.vx, playerMotion.vy) > 14;
    if (moving) {
      playerMotion.walkPhase += dt * 11;
      if (Math.abs(playerMotion.vx) > 8) playerMotion.facing = playerMotion.vx > 0 ? 1 : -1;
    }
    if (playerMotion.celebrate > 0) playerMotion.celebrate = Math.max(0, playerMotion.celebrate - dt);
    if (playerMotion.wave > 0) playerMotion.wave = Math.max(0, playerMotion.wave - dt);

    // Smooth pet companion follow
    const pTargetX = playerMotion.x - playerMotion.facing * 38;
    const pTargetY = playerMotion.y + 14;
    petMotion.x += (pTargetX - petMotion.x) * Math.min(1, dt * 4.5);
    petMotion.y += (pTargetY - petMotion.y) * Math.min(1, dt * 4.5);
    petMotion.hop += dt * (moving ? 9 : 3);

    // Alive NPC AI (wander, rest, wave at player, ambient bubbles)
    for (const n of NPCS) {
      if (n.zone !== state.zone) continue;
      const rt = npcRuntime[n.id];
      if (rt.celebrate > 0) rt.celebrate = Math.max(0, rt.celebrate - dt);
      if (npcAnimTalk[n.id] > 0) npcAnimTalk[n.id] = Math.max(0, npcAnimTalk[n.id] - dt);
      const distPlayer = Math.hypot(playerMotion.x - rt.x, playerMotion.y - rt.y);
      if (distPlayer < 105) {
        rt.facing = playerMotion.x < rt.x ? -1 : 1;
        rt.pause = 0.6;
      } else if (rt.pause > 0) {
        rt.pause -= dt;
      } else if (n.waypoints && n.waypoints.length) {
        const wp = n.waypoints[rt.wpIdx % n.waypoints.length];
        const wx = wp.x - rt.x, wy = wp.y - rt.y;
        const wd = Math.hypot(wx, wy);
        if (wd < 6) {
          rt.wpIdx++;
          rt.pause = 2.0 + Math.random() * 2.5;
        } else {
          rt.x += (wx / wd) * 44 * dt;
          rt.y += (wy / wd) * 44 * dt;
          rt.walkPhase += dt * 7;
          if (Math.abs(wx) > 2) rt.facing = wx > 0 ? 1 : -1;
        }
      }
      rt.bubbleTimer -= dt;
      if (rt.bubbleTimer <= 0) {
        rt.bubble = n.ambient[Math.floor(Math.random() * n.ambient.length)];
        rt.bubbleTimer = 5.5 + Math.random() * 5;
      }
    }

    // Wildlife & weather
    for (const c of clouds) { c.x += c.speed * dt; if (c.x > WORLD_W + 160) c.x = -180; }
    for (const b of butterflies) {
      b.phase += dt * 4.2;
      b.x += Math.cos(b.phase * 0.6) * 28 * dt;
      b.y += Math.sin(b.phase * 0.9) * 20 * dt;
      if (b.x < 40) b.x = WORLD_W - 40;
      if (b.x > WORLD_W - 40) b.x = 40;
    }
    for (const b of birds) {
      b.x += b.speed * dt;
      b.phase += dt * 7;
      if (b.x > WORLD_W + 60) { b.x = -60; b.y = 45 + Math.random() * 140; }
    }
    for (const p of weatherParticles) {
      if (state.weather === 'rain') {
        p.x -= 45 * dt; p.y += p.v * 3.8 * dt;
        if (p.y > WORLD_H) { p.y = -10; p.x = Math.random() * (WORLD_W + 140); }
      } else if (state.weather === 'lanterns') {
        p.y -= p.v * 0.45 * dt; p.sway += dt * 1.5; p.x += Math.sin(p.sway) * 14 * dt;
        if (p.y < -20) { p.y = WORLD_H + 10; p.x = Math.random() * WORLD_W; }
      } else {
        p.x += p.v * 0.32 * dt; p.y += p.v * 0.22 * dt; p.sway += dt * 2.2;
        if (p.x > WORLD_W + 10 || p.y > WORLD_H + 10) { p.x = Math.random() * WORLD_W * 0.7; p.y = -10; }
      }
    }
    for (let i = popups.length - 1; i >= 0; i--) { popups[i].y -= 34 * dt; popups[i].life -= dt; if (popups[i].life <= 0) popups.splice(i, 1); }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const p = bursts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 170 * dt; p.life -= dt * 1.25;
      if (p.life <= 0) bursts.splice(i, 1);
    }
    for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].r += 65 * dt; ripples[i].life -= dt * 1.8; if (ripples[i].life <= 0) ripples.splice(i, 1); }

    // Update floating context interaction FAB
    nearbyTarget = findNearbyTarget();
    const fab = document.getElementById('rpgInteractBtn');
    if (fab) {
      const show = !!nearbyTarget && !activeDlg && document.getElementById('rpgModalWrap').hidden;
      fab.classList.toggle('show', show);
      if (show) document.getElementById('rpgInteractLabel').textContent = nearbyTarget.label;
    }

    // Auto-check gate proximity if walking directly into gate edge
    for (const g of z.gates) {
      if (Math.hypot(g.x - playerMotion.x, g.y - playerMotion.y) < 34) {
        enterZone(g.to);
        break;
      }
    }
  }

  function drawWorld(nowSec) {
    if (!ctx || state.mode !== 'rpg') return;
    const z = ZONES[state.zone] || ZONES.village;
    const w = WORLD_W, h = WORLD_H;

    // 1. Lush painted terrain + subtle sunlit turf pattern
    ctx.fillStyle = z.ground;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = z.groundAlt;
    for (let gx = 0; gx < w; gx += 68) {
      for (let gy = 0; gy < h; gy += 68) {
        if (((gx + gy) / 68) % 2 === 0) {
          ctx.beginPath();
          ctx.arc(gx + 34, gy + 34, 22, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 2. Warm brick / sandstone community pathways
    ctx.fillStyle = z.path;
    ctx.beginPath();
    ctx.roundRect(70, 325, w - 140, 108, 36);
    ctx.roundRect(520, 60, 118, h - 120, 36);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 3;
    ctx.stroke();

    const nightFactor = state.timeOfDay > 0.72 ? Math.min(1, (state.timeOfDay - 0.72) / 0.14) : (state.timeOfDay < 0.12 ? 0.45 : 0);

    // 3. Draw Location Props
    for (const p of z.props) drawProp(p, nowSec, nightFactor);

    // 4. Draw Glowing Zone Gates
    for (const g of z.gates) {
      const pulse = 0.75 + Math.sin(nowSec * 3.2) * 0.25;
      ctx.save();
      ctx.fillStyle = g.secret ? `rgba(167,139,250,${0.32 * pulse})` : `rgba(34,211,238,${0.30 * pulse})`;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 34 + pulse * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(g.x - 64, g.y - 44, 128, 22, 11);
      ctx.fill();
      ctx.fillStyle = g.secret ? '#e9d5ff' : '#67e8f9';
      ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(g.label, g.x, g.y - 29);
      ctx.restore();
    }

    // 5. Destination tap ripple
    for (const r of ripples) {
      ctx.strokeStyle = `rgba(34,211,238,${Math.max(0, r.life)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 6. Depth-sorted Entities (Pet, Player, NPCs)
    const entities = [
      { kind: 'pet', y: petMotion.y },
      { kind: 'player', y: playerMotion.y },
      ...NPCS.filter((n) => n.zone === state.zone).map((n) => ({ kind: 'npc', npc: n, y: npcRuntime[n.id].y })),
    ].sort((a, b) => a.y - b.y);

    for (const e of entities) {
      if (e.kind === 'pet') drawPet(nowSec);
      else if (e.kind === 'player') drawCharacter(playerMotion.x, playerMotion.y, state.player.skin, state.player.hair, OUTFITS.find((o) => o.id === state.player.outfit) || OUTFITS[0], state.player.accessory, playerMotion.walkPhase, playerMotion.facing, playerMotion.celebrate, playerMotion.wave, 0, state.player.name, true, nowSec);
      else drawNpcEntity(e.npc, nowSec);
    }

    // 7. Ambient Wildlife (Butterflies, Birds, Clouds)
    for (const b of butterflies) {
      const flap = Math.abs(Math.sin(b.phase * 3));
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(b.x - 4, b.y, 4 * flap + 1, 3, -0.3, 0, Math.PI * 2);
      ctx.ellipse(b.x + 4, b.y, 4 * flap + 1, 3, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(15,23,42,0.45)';
    ctx.lineWidth = 2;
    for (const b of birds) {
      const wing = Math.sin(b.phase) * 5;
      ctx.beginPath();
      ctx.moveTo(b.x - 9, b.y + wing);
      ctx.quadraticCurveTo(b.x - 4, b.y - 4, b.x, b.y);
      ctx.quadraticCurveTo(b.x + 4, b.y - 4, b.x + 9, b.y + wing);
      ctx.stroke();
    }
    ctx.fillStyle = nightFactor > 0.4 ? 'rgba(203,213,225,0.08)' : 'rgba(255,255,255,0.22)';
    for (const c of clouds) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w * 0.5, 22, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + c.w * 0.25, c.y - 10, c.w * 0.34, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 8. Day / Night & Weather Atmospheric Grade
    if (state.timeOfDay > 0.56 && state.timeOfDay <= 0.76) {
      ctx.fillStyle = 'rgba(249,115,22,0.16)';
      ctx.fillRect(0, 0, w, h);
    } else if (nightFactor > 0) {
      ctx.fillStyle = `rgba(8,15,38,${0.48 * nightFactor})`;
      ctx.fillRect(0, 0, w, h);
      // Warm glow halos around lanterns at night!
      for (const p of z.props) {
        if (p.type === 'lantern' || p.type === 'wishLantern') {
          const g = ctx.createRadialGradient(p.x, p.y - 18, 4, p.x, p.y - 18, 86);
          g.addColorStop(0, `rgba(251,191,36,${0.48 * nightFactor})`);
          g.addColorStop(1, 'rgba(251,191,36,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y - 18, 86, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Weather particles (monsoon rain / floating petals / rising sky lanterns)
    for (const p of weatherParticles) {
      if (state.weather === 'rain') {
        ctx.strokeStyle = 'rgba(186,230,253,0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 5, p.y + 14);
        ctx.stroke();
      } else if (state.weather === 'lanterns') {
        ctx.fillStyle = 'rgba(251,191,36,0.72)';
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, 7, 10, 3);
        ctx.fill();
      } else if (state.weather === 'breeze') {
        ctx.fillStyle = 'rgba(254,205,211,0.75)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 4, 2.2, p.sway, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 9. Particle Bursts & Floating XP / Coin Popups
    for (const p of bursts) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const pop of popups) {
      ctx.globalAlpha = Math.min(1, pop.life);
      ctx.font = '800 15px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#07111e';
      ctx.fillText(pop.text, pop.x + 1, pop.y + 1);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawProp(p, t, nightFactor) {
    ctx.save();
    if (p.type === 'pond' || p.type === 'river') {
      ctx.fillStyle = p.glowing ? '#0891b2' : '#1f9cb5';
      ctx.beginPath();
      if (p.type === 'pond') ctx.roundRect(p.x, p.y, p.w, p.h, 58);
      else ctx.rect(p.x, p.y, p.w, p.h);
      ctx.fill();
      // Animated shimmering ripples & pink lotus blossoms
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const rx = p.x + 48 + ((i * 95 + t * 14) % Math.max(60, p.w - 80));
        const ry = p.y + 34 + (i % 3) * 42;
        ctx.beginPath();
        ctx.ellipse(rx, ry, 18 + Math.sin(t * 2 + i) * 4, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (p.type === 'pond') {
        for (let i = 0; i < 5; i++) {
          const lx = p.x + 48 + i * (p.w - 96) / 4;
          const ly = p.y + p.h * 0.48 + Math.sin(i * 2.1 + t) * 18;
          ctx.fillStyle = '#15803d';
          ctx.beginPath(); ctx.ellipse(lx, ly, 15, 10, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = p.glowing ? '#fde047' : '#f472b6';
          ctx.beginPath(); ctx.arc(lx, ly - 3, 7, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        // Gentle drifting wooden riverboat
        const bx = (t * 26) % (WORLD_W + 160) - 80;
        const by = p.y + p.h * 0.52;
        ctx.fillStyle = '#92400e';
        ctx.beginPath(); ctx.ellipse(bx, by, 38, 11, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(bx - 16, by - 14, 32, 10);
      }
    } else if (p.type === 'bridge') {
      ctx.fillStyle = '#92400e';
      ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 8); ctx.fill();
      ctx.strokeStyle = '#d97706'; ctx.lineWidth = 3; ctx.stroke();
    } else if (p.type === 'stiltHouse' || p.type === 'school' || p.type === 'marketDome' || p.type === 'kiosk' || p.type === 'stage') {
      // Soft ground shadow
      ctx.fillStyle = 'rgba(15,23,42,0.22)';
      ctx.beginPath(); ctx.roundRect(p.x + 8, p.y + 12, p.w, p.h, 16); ctx.fill();
      // Building body
      ctx.fillStyle = p.type === 'school' ? '#fef3c7' : (p.type === 'marketDome' ? '#fde68a' : (p.type === 'stage' ? '#312e81' : '#b45309'));
      ctx.beginPath(); ctx.roundRect(p.x, p.y + 26, p.w, p.h - 26, 12); ctx.fill();
      // Iconic Khmer peaked roof
      ctx.fillStyle = p.roof || (p.type === 'school' ? '#c2410c' : (p.type === 'marketDome' ? '#d97706' : '#f59e0b'));
      ctx.beginPath();
      ctx.moveTo(p.x - 10, p.y + 34);
      ctx.lineTo(p.x + p.w / 2, p.y - 12);
      ctx.lineTo(p.x + p.w + 10, p.y + 34);
      ctx.closePath();
      ctx.fill();
      // Warm windows
      ctx.fillStyle = nightFactor > 0.3 ? '#fde047' : '#38bdf8';
      for (let wx = p.x + 24; wx < p.x + p.w - 30; wx += 48) {
        ctx.fillRect(wx, p.y + 52, 24, 24);
      }
      if (p.name) {
        ctx.fillStyle = '#0f172a';
        ctx.font = '800 11.5px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, p.x + p.w / 2, p.y + p.h + 18);
      }
    } else if (p.type === 'stall') {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(p.x + 8, p.y + 30, p.w - 16, p.h - 30);
      ctx.fillStyle = p.canopy || '#ef4444';
      ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, 38, 10); ctx.fill();
      // Colorful fruit baskets
      ['#facc15', '#ec4899', '#22c55e', '#fb923c'].forEach((c, idx) => {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(p.x + 28 + idx * 36, p.y + 58, 11, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.label, p.x + p.w / 2, p.y + 23);
    } else if (p.type === 'stupa') {
      ctx.fillStyle = 'rgba(15,23,42,0.22)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 62, 68, 20, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.moveTo(p.x - 52, p.y + 56);
      ctx.lineTo(p.x - 24, p.y - 6);
      ctx.lineTo(p.x, p.y - 78);
      ctx.lineTo(p.x + 24, p.y - 6);
      ctx.lineTo(p.x + 52, p.y + 56);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#0f172a'; ctx.font = '800 12px "Plus Jakarta Sans", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(p.name, p.x, p.y + 78);
    } else if (p.type === 'tuktuk') {
      ctx.fillStyle = 'rgba(15,23,42,0.25)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 22, 42, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.roundRect(p.x - 36, p.y - 16, 72, 34, 10); ctx.fill();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.roundRect(p.x - 30, p.y - 26, 60, 14, 7); ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath(); ctx.arc(p.x + 34, p.y, 5, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'palm') {
      const sway = Math.sin(t * 1.6 + p.x) * 4;
      ctx.strokeStyle = '#7c4a26';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + 12);
      ctx.quadraticCurveTo(p.x + 8, p.y - 22, p.x + sway, p.y - 54);
      ctx.stroke();
      ctx.fillStyle = '#15803d';
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + sway * 0.02;
        ctx.beginPath();
        ctx.ellipse(p.x + sway + Math.cos(a) * 20, p.y - 54 + Math.sin(a) * 14, 22, 7, a, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.type === 'garden') {
      ctx.fillStyle = '#2f855a';
      ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 18); ctx.fill();
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = ['#f472b6', '#fde047', '#ffffff', '#fb923c'][i % 4];
        ctx.beginPath(); ctx.arc(p.x + 24 + (i * 39) % (p.w - 40), p.y + 24 + ((i * 29) % (p.h - 40)), 5, 0, Math.PI * 2); ctx.fill();
      }
    } else if (p.type === 'bench') {
      ctx.fillStyle = '#92400e';
      ctx.beginPath(); ctx.roundRect(p.x - 28, p.y - 8, 56, 16, 5); ctx.fill();
    } else if (p.type === 'flagpole') {
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(p.x - 2, p.y - 68, 4, 72);
      ctx.fillStyle = '#1d4ed8'; ctx.fillRect(p.x + 2, p.y - 66, 36, 22);
      ctx.fillStyle = '#dc2626'; ctx.fillRect(p.x + 2, p.y - 60, 36, 10);
    } else if (p.type === 'lantern' || p.type === 'wishLantern') {
      const lit = p.type === 'lantern' || state.litLanterns.includes(p.id);
      ctx.fillStyle = '#475569'; ctx.fillRect(p.x - 2, p.y - 24, 4, 26);
      ctx.fillStyle = lit ? '#fbbf24' : '#94a3b8';
      ctx.beginPath(); ctx.roundRect(p.x - 8, p.y - 38, 16, 18, 6); ctx.fill();
      if (p.type === 'wishLantern' && !lit) {
        ctx.fillStyle = '#fde047'; ctx.font = '800 13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('✨', p.x, p.y - 46 + Math.sin(t * 4) * 3);
      }
    } else if (p.type === 'board' || p.type === 'minigame') {
      ctx.fillStyle = p.type === 'minigame' ? '#f59e0b' : '#78350f';
      ctx.beginPath(); ctx.roundRect(p.x - 26, p.y - 28, 52, 34, 8); ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.font = '800 16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(p.type === 'minigame' ? '🥭' : '🪧', p.x, p.y - 6);
    } else if (p.type === 'collectible' && !state.collectibles.includes(p.id)) {
      const bob = Math.sin(t * 4 + p.x) * 5;
      ctx.fillStyle = 'rgba(251,191,36,0.28)';
      ctx.beginPath(); ctx.arc(p.x, p.y + bob, 18, 0, Math.PI * 2); ctx.fill();
      ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(p.icon, p.x, p.y + 7 + bob);
    }
    ctx.restore();
  }

  function drawCharacter(x, y, skin, hair, outfit, accessory, walkPhase, facing, celebrate, wave, talkTimer, label, isPlayer, nowSec) {
    ctx.save();
    const jump = celebrate > 0 ? Math.abs(Math.sin(celebrate * 9)) * 18 : 0;
    const stride = Math.sin(walkPhase) * 5;
    const breath = Math.sin(nowSec * 3.1 + x) * 1.1;
    const blink = Math.sin(nowSec * 0.9 + x) > 0.97;

    // Ground shadow
    ctx.fillStyle = 'rgba(15,23,42,0.28)';
    ctx.beginPath(); ctx.ellipse(x, y + 18, 16, 6, 0, 0, Math.PI * 2); ctx.fill();

    // Player luminous selection ring
    if (isPlayer) {
      ctx.strokeStyle = 'rgba(69,215,208,0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(x, y + 18, 20, 8, 0, 0, Math.PI * 2); ctx.stroke();
    }

    const cy = y - jump;
    // Legs
    ctx.strokeStyle = outfit.pants || '#1e293b';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 5, cy + 5); ctx.lineTo(x - 5 - stride * 0.6, cy + 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 5, cy + 5); ctx.lineTo(x + 5 + stride * 0.6, cy + 16); ctx.stroke();

    // Torso
    ctx.fillStyle = outfit.body;
    ctx.beginPath(); ctx.roundRect(x - 11, cy - 11 - breath * 0.5, 22, 19 + breath * 0.5, 7); ctx.fill();
    // Krama / trim accent
    ctx.fillStyle = outfit.trim || '#ffffff';
    ctx.fillRect(x - 8, cy - 9, 16, 4);

    // Arms (wave or swing!)
    ctx.strokeStyle = skin;
    ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(x - 11, cy - 6); ctx.lineTo(x - 15, cy + 4 + stride * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 11, cy - 6);
    if (wave > 0 || celebrate > 0) ctx.lineTo(x + 19, cy - 18 + Math.sin(nowSec * 18) * 4);
    else ctx.lineTo(x + 15, cy + 4 - stride * 0.4);
    ctx.stroke();

    // Head
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(x, cy - 20, 12.5, 0, Math.PI * 2); ctx.fill();
    // Hair
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.arc(x, cy - 23, 12.5, Math.PI, Math.PI * 2); ctx.fill();

    // Eyes (blinking!)
    const ex = facing * 2.2;
    ctx.fillStyle = '#0f172a';
    if (blink) {
      ctx.fillRect(x - 6 + ex, cy - 20, 4, 1.5);
      ctx.fillRect(x + 2 + ex, cy - 20, 4, 1.5);
    } else {
      ctx.beginPath(); ctx.arc(x - 4 + ex, cy - 20, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 4 + ex, cy - 20, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    // Mouth (animated when talking!)
    ctx.fillStyle = '#be123c';
    if (talkTimer > 0) {
      const open = 2 + Math.abs(Math.sin(nowSec * 16)) * 3.5;
      ctx.beginPath(); ctx.ellipse(x + ex, cy - 14, 3.2, open, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = '#9f1239'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x + ex, cy - 16, 3.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }

    // Accessories
    if (accessory === 'cap') {
      ctx.fillStyle = '#0284c7'; ctx.beginPath(); ctx.roundRect(x - 13, cy - 33, 26, 7, 4); ctx.fill();
    } else if (accessory === 'lotus') {
      ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.arc(x + 9, cy - 28, 4, 0, Math.PI * 2); ctx.fill();
    } else if (accessory === 'glasses') {
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.4;
      ctx.strokeRect(x - 7 + ex, cy - 22, 5, 4); ctx.strokeRect(x + 1 + ex, cy - 22, 5, 4);
    }

    // Nameplate
    ctx.fillStyle = 'rgba(11,18,32,0.78)';
    ctx.beginPath(); ctx.roundRect(x - 36, cy + 22, 72, 17, 8); ctx.fill();
    ctx.fillStyle = isPlayer ? '#67e8f9' : '#f8fafc';
    ctx.font = '700 10.5px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, cy + 34);
    ctx.restore();
  }

  function drawNpcEntity(npc, nowSec) {
    const rt = npcRuntime[npc.id];
    const hasQuest = QUEST_DEFS.some((q) => q.npc === npc.id && !state.quests[q.id]?.done);
    drawCharacter(
      rt.x, rt.y, npc.skin, npc.hair,
      { body: npc.shirt, trim: '#fde68a', pants: '#334155' }, 'none',
      rt.walkPhase, rt.facing, rt.celebrate,
      Math.hypot(playerMotion.x - rt.x, playerMotion.y - rt.y) < 110 ? 1 : 0,
      npcAnimTalk[npc.id] || 0, npc.name, false, nowSec,
    );
    // Floating Quest Indicator (!) or ambient speech bubble
    if (hasQuest) {
      const bob = Math.sin(nowSec * 4.5) * 4;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(rt.x, rt.y - 48 + bob, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1e1300';
      ctx.font = '900 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('!', rt.x, rt.y - 43 + bob);
    } else if (rt.bubble && rt.bubbleTimer > 2.2) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath(); ctx.roundRect(rt.x - 66, rt.y - 62, 132, 22, 11); ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 10px "Plus Jakarta Sans", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(rt.bubble, rt.x, rt.y - 48);
    }
  }

  function drawPet(nowSec) {
    const pet = PETS.find((p) => p.id === state.player.pet) || PETS[0];
    const hop = Math.abs(Math.sin(petMotion.hop)) * 6;
    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.22)';
    ctx.beginPath(); ctx.ellipse(petMotion.x, petMotion.y + 10, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pet.color;
    ctx.beginPath(); ctx.arc(petMotion.x, petMotion.y - hop, 11, 0, Math.PI * 2); ctx.fill();
    ctx.font = '15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(pet.icon, petMotion.x, petMotion.y + 5 - hop);
    if (playerMotion.celebrate > 0) {
      ctx.fillStyle = '#f472b6';
      ctx.font = '12px sans-serif';
      ctx.fillText('💛', petMotion.x, petMotion.y - 16 - Math.sin(nowSec * 8) * 3);
    }
    ctx.restore();
  }

  /* ==========================================================================
     EVENTS & MAIN 60-FPS GAME LOOP
     ========================================================================== */
  function bindEvents() {
    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      if (state.mode !== 'rpg') return;
      if (e.code === 'KeyE' || e.code === 'Space') {
        if (!activeDlg && document.getElementById('rpgModalWrap').hidden && nearbyTarget) {
          e.preventDefault();
          triggerInteraction(nearbyTarget);
        }
      } else if (e.code === 'Escape') {
        if (activeDlg) closeDialogue();
        else closeModal();
      }
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    // Click / Tap on living world canvas to walk smoothly or interact directly with NPCs!
    canvas.addEventListener('pointerdown', (e) => {
      if (activeDlg || !document.getElementById('rpgModalWrap').hidden) return;
      SFX.init();
      SFX.startMusic();
      const rect = canvas.getBoundingClientRect();
      const wx = ((e.clientX - rect.left) / rect.width) * WORLD_W;
      const wy = ((e.clientY - rect.top) / rect.height) * WORLD_H;

      // Check direct click on an NPC in current zone
      const clickedNpc = NPCS.find((n) => n.zone === state.zone && Math.hypot(npcRuntime[n.id].x - wx, npcRuntime[n.id].y - wy) < 42);
      if (clickedNpc && Math.hypot(npcRuntime[clickedNpc.id].x - playerMotion.x, npcRuntime[clickedNpc.id].y - playerMotion.y) < 165) {
        openDialogue(clickedNpc);
        return;
      }
      playerMotion.targetX = wx;
      playerMotion.targetY = wy;
      ripples.push({ x: wx, y: wy, r: 6, life: 1 });
    });

    // Touch D-pad
    document.querySelectorAll('.rpg-dpad-btn').forEach((btn) => {
      const dir = btn.getAttribute('data-dir');
      if (dir === 'act') {
        btn.addEventListener('click', () => triggerInteraction(nearbyTarget));
      } else {
        const down = () => { keys['_' + dir] = true; };
        const up = () => { keys['_' + dir] = false; };
        btn.addEventListener('pointerdown', down);
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointerleave', up);
        btn.addEventListener('pointercancel', up);
      }
    });

    // HUD & Dock controls
    document.getElementById('rpgInteractBtn').onclick = () => triggerInteraction(nearbyTarget);
    document.getElementById('rpgProfileBtn').onclick = openWardrobeModal;
    document.getElementById('rpgCoinsBtn').onclick = openWardrobeModal;
    document.getElementById('rpgStreakBtn').onclick = openCoachModal;
    document.getElementById('rpgQuestOpenBtn').onclick = openQuestsModal;
    document.getElementById('rpgClassicBtn').onclick = () => setMode('classic');
    document.getElementById('rpgWorldMicBtn').onclick = () => startSpeechRec('world');
    document.getElementById('rpgMusicBtn').onclick = () => {
      state.musicOn = !state.musicOn;
      if (state.musicOn) { SFX.init(); SFX.startMusic(); SFX.softTap(); }
      saveState();
      renderHud();
    };
    document.getElementById('rpgTimeBtn').onclick = () => {
      const stops = [0.08, 0.30, 0.66, 0.86];
      const next = stops.find((s) => s > state.timeOfDay + 0.05) ?? stops[0];
      state.timeOfDay = next;
      saveState();
      renderHud();
    };
    document.getElementById('rpgWeatherBtn').onclick = () => {
      const order = ['sunny', 'breeze', 'rain', 'lanterns'];
      state.weather = order[(order.indexOf(state.weather) + 1) % order.length];
      saveState();
      renderHud();
    };
    document.getElementById('rpgThemeBtn').onclick = () => {
      applyTheme(!document.documentElement.classList.contains('light'), true);
    };
    window.addEventListener('storage', (e) => {
      if (e.key === 'cmc-theme') applyTheme(e.newValue === 'light', false);
    });

    document.querySelectorAll('.rpg-dock-btn[data-open]').forEach((b) => {
      b.addEventListener('click', () => {
        const w = b.getAttribute('data-open');
        if (w === 'map') openWorldMap();
        else if (w === 'quests') openQuestsModal();
        else if (w === 'friends') openFriendsModal();
        else if (w === 'wardrobe') openWardrobeModal();
        else if (w === 'coach') openCoachModal();
      });
    });

    // Dialogue controls
    document.getElementById('rpgDlgClose').onclick = closeDialogue;
    document.getElementById('rpgDlgDoneBtn').onclick = closeDialogue;
    document.getElementById('rpgListenBtn').onclick = () => {
      if (!activeDlg) return;
      speakNpc(document.getElementById('rpgNpcSpeech').textContent, activeDlg.npc, false);
    };
    document.getElementById('rpgSlowBtn').onclick = () => {
      if (!activeDlg) return;
      speakNpc(document.getElementById('rpgNpcSpeech').textContent, activeDlg.npc, true);
    };
    document.getElementById('rpgLevelBtn').onclick = () => {
      const levels = ['A1', 'A2', 'B1'];
      state.levelDiff = levels[(levels.indexOf(state.levelDiff) + 1) % levels.length];
      saveState();
      renderDialogueNode();
    };
    document.getElementById('rpgMicBtn').onclick = () => startSpeechRec('dialogue');
    document.getElementById('rpgSayForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = document.getElementById('rpgSayInput');
      handlePlayerReply(inp.value, 0.92);
    });
    document.getElementById('rpgModalWrap').addEventListener('click', (e) => {
      if (e.target.id === 'rpgModalWrap' && state.welcomed) closeModal();
    });
  }

  let lastTs = 0;
  function frame(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    updateWorld(dt);
    drawWorld(ts / 1000);
    requestAnimationFrame(frame);
  }

  /* ── Boot ── */
  function init() {
    buildShell();
    applyTheme(safeGet('cmc-theme') === 'light', false);
    setMode(state.mode || 'rpg');
    bindEvents();
    renderHud();
    renderQuestPill();
    if (!state.welcomed && state.mode === 'rpg') {
      openWelcomeModal();
    }
    requestAnimationFrame(frame);

    // Expose safe debug/test API
    window.CMC_VQ_RPG = {
      getState: () => state,
      enterZone,
      openDialogueById: (id) => { const n = NPCS.find((x) => x.id === id); if (n) openDialogue(n); },
      submitReply: (txt) => handlePlayerReply(txt, 0.94),
      setMode,
      ZONES,
      NPCS,
      QUEST_DEFS,
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
