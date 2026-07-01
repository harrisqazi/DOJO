// Step-by-step instructions for Yang-24 Tai Chi postures
// Each entry: steps to perform + breathing cue shown before starting

export interface PostureGuide {
  steps: string[];
  breathing: string;
}

const GUIDES: Array<{ keywords: string[]; guide: PostureGuide }> = [
  {
    keywords: ["opening", "commencing", "preparation"],
    guide: {
      steps: [
        "Stand with feet shoulder-width apart, arms hanging loosely at your sides",
        "Breathe in slowly and float both arms forward to shoulder height, palms facing down",
        "Breathe out and press palms downward, bending the knees into a gentle squat",
        "Keep your spine upright and shoulders relaxed — do not lean forward",
      ],
      breathing: "Inhale as arms rise · Exhale as arms lower",
    },
  },
  {
    keywords: ["wild horse", "parting wild"],
    guide: {
      steps: [
        "Shift weight to the right foot and turn your torso slightly right",
        "Step the left foot forward into a bow stance (front knee bent, back leg straight)",
        "Breathe out as the left arm arcs diagonally up-forward to chest height, palm up",
        "Right hand lowers to hip level, palm down — as if parting a horse's mane",
      ],
      breathing: "Exhale as you step and extend the arm",
    },
  },
  {
    keywords: ["white crane", "crane spreads"],
    guide: {
      steps: [
        "Shift almost all weight to the back (right) foot",
        "Let the front (left) foot rest lightly with just the toes touching",
        "Breathe out as the right arm rises up toward the temple, palm facing forward",
        "Left arm lowers in front of the left thigh, palm facing down",
      ],
      breathing: "Exhale as the crane wings open",
    },
  },
  {
    keywords: ["brush knee", "twist step"],
    guide: {
      steps: [
        "Step forward into a left bow stance, sinking the weight onto the front leg",
        "Left hand sweeps across and brushes past the left knee, finishing at the hip",
        "Breathe out as the right hand pushes forward at nose height, palm flat",
        "Keep your torso facing forward — do not lean or twist",
      ],
      breathing: "Exhale as you push through the palm",
    },
  },
  {
    keywords: ["lute", "playing the lute", "strum"],
    guide: {
      steps: [
        "Shift weight back to the right foot; the left foot steps slightly forward (heel only)",
        "Right hand rises to face level, left hand lifts to chest level — like holding a lute",
        "Breathe in as you shift weight back and gather both hands",
        "Keep both arms slightly rounded, elbows dropped",
      ],
      breathing: "Inhale as you shift weight back and gather",
    },
  },
  {
    keywords: ["repulse monkey", "step back", "reverse reeling"],
    guide: {
      steps: [
        "Step backward with the right foot, placing it behind you",
        "Right hand circles back and then pushes forward at shoulder height",
        "Left hand withdraws to the hip as the right hand extends",
        "Breathe out with each push; keep stepping back in a straight line",
      ],
      breathing: "Exhale with each backward step and push",
    },
  },
  {
    keywords: ["grasp", "sparrow", "ward off", "rollback", "press", "push"],
    guide: {
      steps: [
        "Ward Off: step into left bow stance, left arm rounds at chest height (peng)",
        "Rollback: both arms sweep to the right and slightly down as you sit back",
        "Press: right palm presses into left wrist as you shift weight forward (ji)",
        "Push: separate hands, push both palms forward as you step forward (an)",
      ],
      breathing: "Exhale on Ward Off and Press · Inhale on Rollback",
    },
  },
  {
    keywords: ["single whip"],
    guide: {
      steps: [
        "Shift weight to right foot; right hand forms a hook (fingers pinched downward)",
        "Step the left foot out to the left into a wide horse stance",
        "Breathe out as the left arm extends to the left, palm facing outward",
        "The right hook hand extends right — maximum arm span, torso facing forward",
      ],
      breathing: "Exhale as both arms extend to full span",
    },
  },
  {
    keywords: ["wave hands", "cloud", "clouds"],
    guide: {
      steps: [
        "Stand in a wide horse stance, feet parallel and shoulder-width apart",
        "Breathe in as the right arm arcs upward while the left arm sweeps center-low",
        "Shift weight left and step the right foot in; arms smoothly exchange positions",
        "Keep the motion continuous and circular — no jerking",
      ],
      breathing: "Breathe naturally with each arm-exchange wave",
    },
  },
  {
    keywords: ["high pat", "pat on horse"],
    guide: {
      steps: [
        "Step forward into a small bow stance, mostly on the back foot",
        "Right hand rises and presses forward at forehead level, palm flat",
        "Left hand withdraws in front of the left hip, palm up",
        "Breathe out as the right hand pats forward",
      ],
      breathing: "Exhale as the patting hand extends",
    },
  },
  {
    keywords: ["heel kick", "kick"],
    guide: {
      steps: [
        "Shift weight onto the standing leg and raise the other knee to hip height",
        "Breathe out as you extend the kick forward, leading with the heel",
        "Arms open wide to shoulder height for balance — right arm in front",
        "Keep the standing leg slightly bent; hold the kick for a breath",
      ],
      breathing: "Exhale as you extend the kick",
    },
  },
  {
    keywords: ["strike", "both ears", "double fists"],
    guide: {
      steps: [
        "Step forward into a bow stance; bring both fists to hip level",
        "Breathe out as both fists arc upward and inward to ear level in a wide strike",
        "Knuckles face outward, arms form a rounded frame around the opponent's head",
        "Keep shoulders down — power comes from the waist rotation",
      ],
      breathing: "Exhale as fists arc forward and meet",
    },
  },
  {
    keywords: ["lower body", "stand on one leg", "golden rooster"],
    guide: {
      steps: [
        "Sink low into a deep side lunge, sweeping one arm low to the ground",
        "Breathe in as you slowly rise up, drawing the knee upward",
        "Balance on the standing leg; raise the knee to hip height",
        "Arm rises with the knee — extend upward for the 'golden rooster' balance",
      ],
      breathing: "Exhale on the sink · Inhale as you rise",
    },
  },
  {
    keywords: ["shuttle", "fair lady", "through clouds"],
    guide: {
      steps: [
        "Step diagonally forward-left into a bow stance",
        "Left arm rises to block above the forehead, palm facing up-out",
        "Breathe out as the right hand pushes forward at chest height",
        "Then turn and repeat diagonally to the right",
      ],
      breathing: "Exhale on each diagonal push",
    },
  },
  {
    keywords: ["needle", "sea bottom"],
    guide: {
      steps: [
        "Shift weight to the back foot; left foot steps slightly forward",
        "Breathe out as you sink your torso forward and lower the right hand straight down",
        "Right fingertips point toward the ground in a deep forward lean",
        "Left hand holds near the left hip — spine stays aligned even while angled",
      ],
      breathing: "Exhale as you sink the needle downward",
    },
  },
  {
    keywords: ["fan", "flash", "arm"],
    guide: {
      steps: [
        "Rise from the needle and step the right foot back into a bow stance",
        "Breathe out as the right forearm sweeps upward to block at temple height",
        "Simultaneously push the left palm forward at chest level",
        "The block and push happen together — one motion unfolding",
      ],
      breathing: "Exhale as the arm fans open",
    },
  },
  {
    keywords: ["deflect", "parry", "punch"],
    guide: {
      steps: [
        "Turn the body; right hand forms a fist and swings to deflect outward",
        "Step forward and parry with the left forearm across the center",
        "Breathe out as the right fist punches straight forward at chest height",
        "Weight transfers fully to the front leg with the punch",
      ],
      breathing: "Exhale sharply with the final punch",
    },
  },
  {
    keywords: ["apparent close", "close up", "push"],
    guide: {
      steps: [
        "Draw both hands back toward the chest, elbows bent",
        "Breathe in as you separate and draw back the hands",
        "Breathe out as both palms push forward simultaneously",
        "Weight shifts fully forward into a bow stance",
      ],
      breathing: "Inhale pulling back · Exhale pushing forward",
    },
  },
  {
    keywords: ["cross hands"],
    guide: {
      steps: [
        "Shift weight to the right foot and turn toes outward",
        "Both arms open wide to the sides at shoulder height",
        "Breathe in as arms open; breathe out as they cross in front of the chest",
        "Left wrist crosses over right; feet come together parallel",
      ],
      breathing: "Exhale as the hands cross at the chest",
    },
  },
  {
    keywords: ["closing", "conclusion"],
    guide: {
      steps: [
        "Uncross the arms and lower them slowly to the sides, palms facing down",
        "Breathe out slowly as both arms descend",
        "Straighten the knees gently and return to standing upright",
        "Breathe naturally and rest, letting energy settle",
      ],
      breathing: "Long exhale as arms float down",
    },
  },
];

// Default guide when no specific match is found
const DEFAULT_GUIDE: PostureGuide = {
  steps: [
    "Stand sideways to the camera so it can see your full body profile",
    "Move into the posture slowly — pause at the final position",
    "Keep your weight centred, spine upright and shoulders relaxed",
    "Breathe naturally throughout the movement",
  ],
  breathing: "Breathe naturally — exhale on exertion",
};

export function getPostureGuide(postureName: string): PostureGuide {
  const lower = postureName.toLowerCase();
  for (const entry of GUIDES) {
    if (entry.keywords.some(k => lower.includes(k))) {
      return entry.guide;
    }
  }
  return DEFAULT_GUIDE;
}
