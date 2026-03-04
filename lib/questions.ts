// lib/questions.ts
// 100+ life questions in EN and BG, organized by category

export interface LifeQuestion {
  id: number;
  category: string;
  en: string;
  bg: string;
}

export const CATEGORIES_EN: Record<string, string> = {
  childhood:    '🧒 Childhood',
  family:       '👨‍👩‍👧 Family',
  education:    '🎓 Education',
  work:         '💼 Work & Career',
  love:         '❤️ Love & Relationships',
  values:       '🌟 Values & Beliefs',
  challenges:   '💪 Challenges',
  joy:          '😄 Joy & Passions',
  wisdom:       '🦉 Wisdom',
  legacy:       '🕊️ Legacy & Future',
};

export const CATEGORIES_BG: Record<string, string> = {
  childhood:    '🧒 Детство',
  family:       '👨‍👩‍👧 Семейство',
  education:    '🎓 Образование',
  work:         '💼 Работа и кариера',
  love:         '❤️ Любов и отношения',
  values:       '🌟 Ценности и вярвания',
  challenges:   '💪 Предизвикателства',
  joy:          '😄 Радост и страсти',
  wisdom:       '🦉 Мъдрост',
  legacy:       '🕊️ Наследство и бъдеще',
};

export const LIFE_QUESTIONS: LifeQuestion[] = [
  // ── Childhood (1–12) ──────────────────────────────────────────────────────
  { id: 1,  category: 'childhood', en: 'Where were you born and what was it like growing up there?', bg: 'Къде си роден/а и как беше да растеш там?' },
  { id: 2,  category: 'childhood', en: 'What is your earliest memory?', bg: 'Какъв е най-ранният ти спомен?' },
  { id: 3,  category: 'childhood', en: 'What games did you play as a child?', bg: 'На какви игри си играл/а като дете?' },
  { id: 4,  category: 'childhood', en: 'Who was your best friend growing up and what did you do together?', bg: 'Кой беше най-добрият ти приятел в детството и какво правехте заедно?' },
  { id: 5,  category: 'childhood', en: 'What smells or sounds take you straight back to childhood?', bg: 'Какви миризми или звуци те връщат директно в детството?' },
  { id: 6,  category: 'childhood', en: 'What was your home like when you were a child?', bg: 'Как изглеждаше домът ти, когато беше дете?' },
  { id: 7,  category: 'childhood', en: 'What was a typical summer day like for you as a child?', bg: 'Как изглеждаше един типичен летен ден за теб като дете?' },
  { id: 8,  category: 'childhood', en: 'Did you have any pets growing up? Tell me about them.', bg: 'Имал/а ли си домашни любимци? Разкажи ми за тях.' },
  { id: 9,  category: 'childhood', en: 'What were your favourite books, films or TV shows as a child?', bg: 'Кои бяха любимите ти книги, филми или предавания като дете?' },
  { id: 10, category: 'childhood', en: 'What was the bravest or most mischievous thing you did as a child?', bg: 'Какво е най-смелото или палаво нещо, което си правил/а като дете?' },
  { id: 11, category: 'childhood', en: 'What did you dream of becoming when you grew up?', bg: 'За какво мечтаеше да станеш, когато пораснеш?' },
  { id: 12, category: 'childhood', en: 'What is the most important lesson your childhood taught you?', bg: 'Какъв е най-важният урок, който детството те е научило?' },

  // ── Family (13–24) ────────────────────────────────────────────────────────
  { id: 13, category: 'family', en: 'Tell me about your parents — who were they as people?', bg: 'Разкажи ми за родителите си — какви хора бяха?' },
  { id: 14, category: 'family', en: 'What is the most important thing your mother taught you?', bg: 'Какво е най-важното нещо, което майка ти те е научила?' },
  { id: 15, category: 'family', en: 'What is the most important thing your father taught you?', bg: 'Какво е най-важното нещо, което баща ти те е научил?' },
  { id: 16, category: 'family', en: 'Do you have siblings? What was your relationship like?', bg: 'Имаш ли братя или сестри? Каква беше връзката ви?' },
  { id: 17, category: 'family', en: 'Who in your family had the biggest influence on you and why?', bg: 'Кой от семейството ти е имал най-голямо влияние върху теб и защо?' },
  { id: 18, category: 'family', en: 'What family tradition meant the most to you?', bg: 'Коя семейна традиция е означавала най-много за теб?' },
  { id: 19, category: 'family', en: 'What do you wish you had asked your grandparents before they passed?', bg: 'Какво би искал/а да си попитал/а баба или дядо, преди да ги няма?' },
  { id: 20, category: 'family', en: 'What is your proudest moment as a parent or family member?', bg: 'Какъв е най-гордият ти момент като родител или член на семейство?' },
  { id: 21, category: 'family', en: 'How did your family celebrate special occasions?', bg: 'Как семейството ти е отбелязвало специални поводи?' },
  { id: 22, category: 'family', en: 'What family story gets told over and over again?', bg: 'Коя семейна история се разказва отново и отново?' },
  { id: 23, category: 'family', en: 'What values did your family pass on to you that you want to continue?', bg: 'Какви ценности е предало семейството ти, които искаш да продължиш?' },
  { id: 24, category: 'family', en: 'What do you most want your children or grandchildren to know about your family history?', bg: 'Какво най-много искаш децата или внуците ти да знаят за историята на семейството?' },

  // ── Education (25–33) ─────────────────────────────────────────────────────
  { id: 25, category: 'education', en: 'What was your favourite subject in school and why?', bg: 'Кой беше любимият ти предмет в училище и защо?' },
  { id: 26, category: 'education', en: 'Who was the teacher that changed your life, and how?', bg: 'Кой учител промени живота ти и как?' },
  { id: 27, category: 'education', en: 'What was the hardest thing about school for you?', bg: 'Какво беше най-трудното в училище за теб?' },
  { id: 28, category: 'education', en: 'Did you go to university or pursue further training? What was that like?', bg: 'Учил/а ли си в университет или друго обучение? Как беше?' },
  { id: 29, category: 'education', en: 'What is the most important thing you have taught yourself outside of school?', bg: 'Какво е най-важното нещо, което си научил/а сам/а извън училище?' },
  { id: 30, category: 'education', en: 'What book changed the way you see the world?', bg: 'Коя книга промени начина, по който гледаш на света?' },
  { id: 31, category: 'education', en: 'If you could go back to school and study something different, what would it be?', bg: 'Ако можеше да се върнеш и да учиш нещо различно, какво щеше да бъде?' },
  { id: 32, category: 'education', en: 'What skill are you most proud of developing?', bg: 'Коя умение си най-горд/а, че си развил/а?' },
  { id: 33, category: 'education', en: 'What is something you still want to learn?', bg: 'Какво все още искаш да научиш?' },

  // ── Work & Career (34–43) ─────────────────────────────────────────────────
  { id: 34, category: 'work', en: 'What was your very first job and what did you learn from it?', bg: 'Каква беше първата ти работа и какво научи от нея?' },
  { id: 35, category: 'work', en: 'What career are you most proud of?', bg: 'За коя кариера/работа си най-горд/а?' },
  { id: 36, category: 'work', en: 'What was the most difficult professional decision you ever made?', bg: 'Какво беше най-трудното професионално решение, което си взел/а?' },
  { id: 37, category: 'work', en: 'Who was the best boss or colleague you ever had?', bg: 'Кой беше най-добрият ти шеф или колега?' },
  { id: 38, category: 'work', en: 'What did work mean to you beyond just earning money?', bg: 'Какво означаваше работата за теб освен само да изкарваш пари?' },
  { id: 39, category: 'work', en: 'What is the biggest professional failure you learned the most from?', bg: 'Какъв е най-големият ти професионален провал, от който си научил/а най-много?' },
  { id: 40, category: 'work', en: 'If you could give your younger self one piece of career advice, what would it be?', bg: 'Ако можеше да дадеш на по-младия си аз един кариерен съвет, какъв щеше да бъде?' },
  { id: 41, category: 'work', en: 'What project or achievement in your work are you most proud of?', bg: 'Кой проект или постижение в работата те кара да се гордееш най-много?' },
  { id: 42, category: 'work', en: 'How did you manage the balance between work and personal life?', bg: 'Как успяваше да балансираш между работата и личния живот?' },
  { id: 43, category: 'work', en: 'What would you tell young people starting their careers today?', bg: 'Какво би казал/а на млади хора, започващи кариерата си днес?' },

  // ── Love & Relationships (44–53) ──────────────────────────────────────────
  { id: 44, category: 'love', en: 'How did you meet the love of your life?', bg: 'Как срещна любовта на живота си?' },
  { id: 45, category: 'love', en: 'What made you fall in love?', bg: 'Какво те накара да се влюбиш?' },
  { id: 46, category: 'love', en: 'What is the secret to a lasting relationship?', bg: 'Какъв е тайнствата на трайната връзка?' },
  { id: 47, category: 'love', en: 'What is the most romantic thing you have ever done or experienced?', bg: 'Какво е най-романтичното нещо, което си правил/а или преживял/а?' },
  { id: 48, category: 'love', en: 'What qualities do you most value in the people you love?', bg: 'Какви качества ценяш най-много у хората, които обичаш?' },
  { id: 49, category: 'love', en: 'What has love taught you about yourself?', bg: 'Какво те е научила любовта за теб самия/самата?' },
  { id: 50, category: 'love', en: 'Describe your closest friendship — what makes it so special?', bg: 'Опиши най-близкото си приятелство — какво го прави толкова специално?' },
  { id: 51, category: 'love', en: 'How have your relationships changed you as a person?', bg: 'Как са те променили отношенията ти като личност?' },
  { id: 52, category: 'love', en: 'What is something you wish you had expressed more to the people you love?', bg: 'Какво би искал/а да си изказал/а повече на хората, които обичаш?' },
  { id: 53, category: 'love', en: 'What does love mean to you today compared to when you were young?', bg: 'Какво означава любовта за теб днес в сравнение с когато беше млад/а?' },

  // ── Values & Beliefs (54–63) ──────────────────────────────────────────────
  { id: 54, category: 'values', en: 'What are the three values you live by most?', bg: 'Кои са трите ценности, по които живееш най-много?' },
  { id: 55, category: 'values', en: 'Do you believe in God or a higher power? How has that shaped your life?', bg: 'Вярваш ли в Бог или висша сила? Как е оформило това живота ти?' },
  { id: 56, category: 'values', en: 'What does success mean to you?', bg: 'Какво означава успехът за теб?' },
  { id: 57, category: 'values', en: 'What is the one thing you would never compromise on?', bg: 'Кое е нещото, за което никога не би правил/а компромис?' },
  { id: 58, category: 'values', en: 'How do you define happiness?', bg: 'Как дефинираш щастието?' },
  { id: 59, category: 'values', en: 'What role has kindness played in your life?', bg: 'Каква роля е играла добротата в живота ти?' },
  { id: 60, category: 'values', en: 'What political or social change have you witnessed that impacted you the most?', bg: 'Каква политическа или социална промяна си наблюдавал/а, която те е засегнала най-много?' },
  { id: 61, category: 'values', en: 'What is something the world needs more of, in your view?', bg: 'Какво, според теб, трябва повече на света?' },
  { id: 62, category: 'values', en: "How do you handle the difference between right and wrong when it's not clear?", bg: 'Как се справяш с разликата между правилното и грешното, когато не е ясна?' },
  { id: 63, category: 'values', en: 'What has your faith or philosophy of life given you in hard times?', bg: 'Какво ти е дала вярата или философията ти за живота в трудни моменти?' },

  // ── Challenges (64–73) ────────────────────────────────────────────────────
  { id: 64, category: 'challenges', en: 'What is the hardest thing you have ever been through?', bg: 'Кое е най-трудното нещо, през което си минавал/а?' },
  { id: 65, category: 'challenges', en: 'How did you find strength when you felt you had none left?', bg: 'Как намираше сила, когато ти се струваше, че нямаш повече?' },
  { id: 66, category: 'challenges', en: 'What failure turned out to be a blessing in disguise?', bg: 'Кой провал се оказа прикрито благословение?' },
  { id: 67, category: 'challenges', en: 'Have you ever had to start over? What was that like?', bg: 'Налагало ли ти се е да започнеш отначало? Как беше?' },
  { id: 68, category: 'challenges', en: 'What is the biggest risk you ever took and what happened?', bg: 'Какъв е най-големият риск, който си поел/а и какво се случи?' },
  { id: 69, category: 'challenges', en: 'How do you deal with fear?', bg: 'Как се справяш со страха?' },
  { id: 70, category: 'challenges', en: 'What has grief or loss taught you?', bg: 'Какво те е научила скръбта или загубата?' },
  { id: 71, category: 'challenges', en: 'What would you do differently if you could relive a difficult period?', bg: 'Какво би направил/а по-различно, ако можеше да преживееш отново труден период?' },
  { id: 72, category: 'challenges', en: 'Who helped you the most in your darkest moments?', bg: 'Кой ти е помогнал най-много в най-тъмните ти моменти?' },
  { id: 73, category: 'challenges', en: 'What does resilience mean to you?', bg: 'Какво означава устойчивостта за теб?' },

  // ── Joy & Passions (74–83) ────────────────────────────────────────────────
  { id: 74, category: 'joy', en: 'What has brought you the most pure joy in life?', bg: 'Какво ти е донесло най-чиста радост в живота?' },
  { id: 75, category: 'joy', en: 'What hobby or passion has stayed with you the longest?', bg: 'Кое хоби или страст те е следвало най-дълго?' },
  { id: 76, category: 'joy', en: 'What music moves you and why?', bg: 'Каква музика те трогва и защо?' },
  { id: 77, category: 'joy', en: 'What place in the world feels most like home to your soul?', bg: 'Кое място в света се чувства най-близо до душата ти?' },
  { id: 78, category: 'joy', en: 'What food or meal is connected to your happiest memories?', bg: 'Коя храна или ястие е свързано с най-щастливите ти спомени?' },
  { id: 79, category: 'joy', en: 'What simple pleasure never gets old for you?', bg: 'Кое просто удоволствие никога не ти омръзва?' },
  { id: 80, category: 'joy', en: 'What adventure or travel experience shaped you the most?', bg: 'Кое приключение или пътуване те е оформило най-много?' },
  { id: 81, category: 'joy', en: 'What creative thing have you made that you are proudest of?', bg: 'Кое творческо нещо, което си направил/а, те кара да се гордееш?' },
  { id: 82, category: 'joy', en: 'When do you feel most fully alive?', bg: 'Кога се чувстваш най-напълно жив/а?' },
  { id: 83, category: 'joy', en: 'What made you laugh more than anything else in life?', bg: 'Какво те е карало да се смееш повече от всичко друго в живота?' },

  // ── Wisdom (84–93) ────────────────────────────────────────────────────────
  { id: 84, category: 'wisdom', en: 'What is the wisest advice anyone ever gave you?', bg: 'Какъв е най-мъдрият съвет, който някога са ти давали?' },
  { id: 85, category: 'wisdom', en: 'What do you know now that you wish you had known at 20?', bg: 'Какво знаеш сега, което би искал/а да знаеш на 20 години?' },
  { id: 86, category: 'wisdom', en: 'What is the one thing you would tell every young person?', bg: 'Кое е нещото, което би казал/а на всеки млад човек?' },
  { id: 87, category: 'wisdom', en: 'How has your understanding of life changed as you have grown older?', bg: 'Как се е променило разбирането ти за живота, докато си застарявал/а?' },
  { id: 88, category: 'wisdom', en: 'What do you think is the biggest mistake people make in life?', bg: 'Каква е, според теб, най-голямата грешка, която хората правят в живота?' },
  { id: 89, category: 'wisdom', en: 'What is the most important thing you have learned about yourself?', bg: 'Какво е най-важното нещо, което си научил/а за себе си?' },
  { id: 90, category: 'wisdom', en: 'What do people misunderstand about you most?', bg: 'Какво хората най-много разбират погрешно за теб?' },
  { id: 91, category: 'wisdom', en: 'What is one regret you have and what does it teach you?', bg: 'Кое е едно съжаление, което имаш и какво те учи то?' },
  { id: 92, category: 'wisdom', en: 'What question about life do you still not have the answer to?', bg: 'Кой въпрос за живота все още нямаш отговор?' },
  { id: 93, category: 'wisdom', en: 'What habit has served you best throughout your life?', bg: 'Кой навик ти е служил най-добре през целия живот?' },

  // ── Legacy & Future (94–105) ──────────────────────────────────────────────
  { id: 94,  category: 'legacy', en: 'How do you want to be remembered?', bg: 'Как искаш да бъдеш запомнен/а?' },
  { id: 95,  category: 'legacy', en: 'What is the most important thing you want to pass on to the next generation?', bg: 'Какво е най-важното нещо, което искаш да предадеш на следващото поколение?' },
  { id: 96,  category: 'legacy', en: 'What message do you have for your children or grandchildren?', bg: 'Какво послание имаш за децата или внуците си?' },
  { id: 97,  category: 'legacy', en: 'What does a life well-lived look like to you?', bg: 'Как изглежда добре изживян живот за теб?' },
  { id: 98,  category: 'legacy', en: 'If you could give one gift to the world, what would it be?', bg: 'Ако можеше да дадеш един подарък на света, какъв щеше да бъде?' },
  { id: 99,  category: 'legacy', en: 'What story from your life do you most want preserved forever?', bg: 'Коя история от живота ти най-много искаш да бъде запазена завинаги?' },
  { id: 100, category: 'legacy', en: 'What are you still hoping to do or experience?', bg: 'За какво все още се надяваш да направиш или преживееш?' },
  { id: 101, category: 'legacy', en: 'What would a perfect day look like for you right now?', bg: 'Как би изглеждал перфектният ден за теб в момента?' },
  { id: 102, category: 'legacy', en: 'What has surprised you most about the life you ended up living?', bg: 'Какво те е изненадало най-много в живота, който в крайна сметка си живял/а?' },
  { id: 103, category: 'legacy', en: 'If you could speak to your future great-grandchildren, what would you say?', bg: 'Ако можеше да говориш с бъдещите си правнуци, какво би им казал/а?' },
  { id: 104, category: 'legacy', en: 'What do you hope the world looks like in 50 years?', bg: 'Как се надяваш да изглежда светът след 50 години?' },
  { id: 105, category: 'legacy', en: 'What is the last thing you want the people you love to know about you?', bg: 'Какво е последното нещо, което искаш хората, обичащи те, да знаят за теб?' },
];

// Helper: get questions by category
export function getQuestionsByCategory(category: string): LifeQuestion[] {
  return LIFE_QUESTIONS.filter(q => q.category === category);
}

// Helper: get total count
export const TOTAL_QUESTIONS = LIFE_QUESTIONS.length;

// Questions per page in the UI
export const QUESTIONS_PER_PAGE = 5;
