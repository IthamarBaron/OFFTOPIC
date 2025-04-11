// questions.js
const questionPairs = [
  {
    normal: "What's your favorite food?",
    impostor: "What's a \"good\" food that you hate?",
    category: "food"
  },
  {
    normal: "What's the most overrated tourist destination?",
    impostor: "What's your dream vacation spot?",
    category: "travel"
  },
  {
    normal: "What's your favorite hobby?",
    impostor: "What hobby do you find a waste of time?",
    category: "hobbies"
  },
  {
    normal: "Name a movie everyone should watch.",
    impostor: "Name a movie you couldn't finish.",
    category: "entertainment"
  },
  {
    normal: "What superpower would you want?",
    impostor: "Name a useless superpower?",
    category: "powers"
  },
  {
    normal: "What's a holiday you'd like to celebrate more?",
    impostor: "What's a holiday that feels totally overrated?",
    category: "life"
  },
  {
    normal: "What's a game you always cheat at?",
    impostor: "What's a game you never understood the rules of?",
    category: "entertainment"
  },
  {
    normal: "What's a store you love walking through?",
    impostor: "What's a store that overwhelms you?",
    category: "stuff"
  },
  {
    normal: "What's a noise that instantly annoys you?",
    impostor: "Your most hated song",
    category: "life"
  },
  {
    normal: "What's a food you could eat forever?",
    impostor: "What's a food that tastes better than it smells?",
    category: "food"
  },
  {
    normal: "What's a celebrity you'd want to be friends with?",
    impostor: "What's a celebrity you think is low-key scary?",
    category: "entertainment"
  },
  {
    normal: "What's something you'd want in an apocalypse?",
    impostor: "What's the worst birthday gift you've received?",
    category: "stuff"
  },
  {
    normal: "How many hours of sleep do you need to function?",
    impostor: "How many unread emails is too many?",
    category: "numbers"
  },
  {
    normal: "What's a creature you might eat if stranded on an island?",
    impostor: "What's the grossest animal you’ve ever seen in real life?",
    category: "animals"
  },
  {
    normal: "What's something you'd keep in your glovebox?",
    impostor: "What's a small item that always ends up in your junk drawer?",
    category: "stuff"
  },
  {
    normal: "What's a small luxury you'd take to space?",
    impostor: "What's something pointless people bring to work?",
    category: "stuff"
  },
  {
    normal: "How many pets would be too many for you?",
    impostor: "How many meals do you eat per day",
    category: "numbers"
  },
  {
    normal: "What’s the weirdest food you’ve willingly eaten?",
    impostor: "What’s something you’ve eaten just to be polite?",
    category: "food"
  },
  {
    normal: "What's an animal you’d ride if it were big enough?",
    impostor: "What’s an animal that looks cooler than it is?",
    category: "animals"
  },
  {
    normal: "What’s a room in a house that should always smell nice?",
    impostor: "What’s a room that always smells weird no matter what?",
    category: "life"
  },
  {
    normal: "How many pillows do you sleep with?",
    impostor: "What’s minumum amount of urinals to stand next to somone",
    category: "numbers"
  },
  {
    normal: "What's a sport you like to watch?",
    impostor: "What's a sport that's totally overrated?",
    category: "sports"
  },
  {
    normal: "What's a hobby you'd start if you had time?",
    impostor: "What's a hobby people pretend to enjoy?",
    category: "hobbies"
  },
  {
    normal: "What's a job you'd do for free?",
    impostor: "What's a job that sounds fun but is secretly awful?",
    category: "work"
  },
  {
    normal: "How many urinals away is acceptable?",
    impostor: "What’s the most partners you’ve had at once?",
    category: "numbers"
  },
  {
    normal: "What's a snack that you always finish in one sitting?",
    impostor: "What's a snack that disappears too fast at parties?",
    category: "food"
  },
  {
    normal: "What's something you'd say to sound smart?",
    impostor: "What's something you've said to fill awkward silence?",
    category: "life"
  },
  {
    normal: "What's a great fake name to use at a Caffe",
    impostor: "What's a name you'd give a digital pet?",
    category: "stuff"
  },
  {
    normal: "What's a smell that makes you hungry?",
    impostor: "What's a smell that makes you irrationally angry?",
    category: "life"
  },
  {
    normal: "What's a quote from a movie you love?",
    impostor: "What's the most romantic thing you could say to someone?",
    category: "entertainment"
  },
  {
    normal: "What’s a phrase you’d get tattooed?",
    impostor: "What’s something you’d whisper dramatically before dying?",
    category: "life"
  },
  {
    normal: "What’s a phrase your parents used all the time?",
    impostor: "What's a phrase that sounds wise?",
    category: "life"
  },
  {
    normal: "What's a phrase you'd put on a T-shirt?",
    impostor: "What's something someone texted you that still haunts you?",
    category: "stuff"
  },
  {
    normal: "What would be your last meal?",
    impostor: "What did you eat this morning?",
    category: "food"
  },
  {
    normal: "What cartoon character could you beat in a fight?",
    impostor: "Which cartoon character is most underrated?",
    category: "entertainment"
  },
  {
    normal: "Name a celebrity you'd wanna swap with",
    impostor: "Give me a cool one here chat",
    category: "entertainment"
  },
  {
    normal: "What sport should be added to the Olympics?",
    impostor: "What's the weirdest sport you can think of?",
    category: "sports"
  }
];

module.exports = { questionPairs };