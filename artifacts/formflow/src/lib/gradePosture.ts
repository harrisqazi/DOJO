export function computeAngle(A: {x:number,y:number}, B: {x:number,y:number}, C: {x:number,y:number}): number {
  const BA = { x: A.x - B.x, y: A.y - B.y }
  const BC = { x: C.x - B.x, y: C.y - B.y }
  const dot = BA.x * BC.x + BA.y * BC.y
  const magBA = Math.sqrt(BA.x**2 + BA.y**2)
  const magBC = Math.sqrt(BC.x**2 + BC.y**2)
  return Math.round((Math.acos(Math.max(-1, Math.min(1, dot / (magBA * magBC)))) * 180) / Math.PI)
}

type JointRule = { joint_id: string; landmark_a: string; landmark_b: string; landmark_c: string; target_angle: number; tolerance_degrees: number; weight: number; cue_too_low?: string|null; cue_too_high?: string|null }
type GradeResult = { score: number; feedback: string[]; jointResults: Array<{id: string; actual: number; target: number; status: 'good'|'close'|'off'}> }

export function gradePose(landmarks: any[], joints: JointRule[]): GradeResult {
  // landmarks: array of {x,y,z,visibility} indexed by MediaPipe landmark index
  // Build lookup by landmark name
  const LANDMARK_NAMES = ['NOSE','LEFT_EYE_INNER','LEFT_EYE','LEFT_EYE_OUTER','RIGHT_EYE_INNER','RIGHT_EYE','RIGHT_EYE_OUTER','LEFT_EAR','RIGHT_EAR','MOUTH_LEFT','MOUTH_RIGHT','LEFT_SHOULDER','RIGHT_SHOULDER','LEFT_ELBOW','RIGHT_ELBOW','LEFT_WRIST','RIGHT_WRIST','LEFT_PINKY','RIGHT_PINKY','LEFT_INDEX','RIGHT_INDEX','LEFT_THUMB','RIGHT_THUMB','LEFT_HIP','RIGHT_HIP','LEFT_KNEE','RIGHT_KNEE','LEFT_ANKLE','RIGHT_ANKLE','LEFT_HEEL','RIGHT_HEEL','LEFT_FOOT_INDEX','RIGHT_FOOT_INDEX']
  const lm: Record<string, {x:number,y:number}> = {}
  LANDMARK_NAMES.forEach((name, i) => { if (landmarks[i]) lm[name] = landmarks[i] })

  let score = 0
  const feedback: string[] = []
  const jointResults: GradeResult['jointResults'] = []

  joints.forEach(j => {
    const A = lm[j.landmark_a], B = lm[j.landmark_b], C = lm[j.landmark_c]
    if (!A || !B || !C) return
    const actual = computeAngle(A, B, C)
    const diff = Math.abs(actual - j.target_angle)
    const status: 'good'|'close'|'off' = diff <= j.tolerance_degrees ? 'good' : diff <= j.tolerance_degrees * 2 ? 'close' : 'off'
    const contribution = j.weight * (1 - Math.min(diff / j.tolerance_degrees, 1)) * 100
    score += contribution
    jointResults.push({ id: j.joint_id, actual, target: j.target_angle, status })
    if ((status === 'off' || status === 'close') && feedback.length < 2) {
      if (actual < j.target_angle && j.cue_too_low) feedback.push(j.cue_too_low)
      else if (actual > j.target_angle && j.cue_too_high) feedback.push(j.cue_too_high)
    }
  })

  return { score: Math.max(0, Math.min(100, score)), feedback, jointResults }
}

export function detectStillness(landmarkHistory: any[][]): boolean {
  if (landmarkHistory.length < 45) return false
  const MAJOR = [0,11,12,13,14,15,16,23,24,25,26,27,28]
  let totalMovement = 0
  for (let f = 1; f < landmarkHistory.length; f++) {
    for (const idx of MAJOR) {
      const prev = landmarkHistory[f-1][idx], curr = landmarkHistory[f][idx]
      if (!prev || !curr) continue
      totalMovement += (curr.x-prev.x)**2 + (curr.y-prev.y)**2
    }
  }
  return totalMovement / (landmarkHistory.length * MAJOR.length) < 0.002
}

export function extractAnglesFromLandmarks(frames: any[][]): Record<string, number> {
  const LANDMARK_NAMES = ['NOSE','LEFT_EYE_INNER','LEFT_EYE','LEFT_EYE_OUTER','RIGHT_EYE_INNER','RIGHT_EYE','RIGHT_EYE_OUTER','LEFT_EAR','RIGHT_EAR','MOUTH_LEFT','MOUTH_RIGHT','LEFT_SHOULDER','RIGHT_SHOULDER','LEFT_ELBOW','RIGHT_ELBOW','LEFT_WRIST','RIGHT_WRIST','LEFT_PINKY','RIGHT_PINKY','LEFT_INDEX','RIGHT_INDEX','LEFT_THUMB','RIGHT_THUMB','LEFT_HIP','RIGHT_HIP','LEFT_KNEE','RIGHT_KNEE','LEFT_ANKLE','RIGHT_ANKLE','LEFT_HEEL','RIGHT_HEEL','LEFT_FOOT_INDEX','RIGHT_FOOT_INDEX']
  const recent = frames.slice(-15)
  const TRIPLETS: Array<[string, string, string, string]> = [
    ['spine','LEFT_SHOULDER','LEFT_HIP','LEFT_KNEE'],['front_knee','LEFT_HIP','LEFT_KNEE','LEFT_ANKLE'],
    ['rear_knee','RIGHT_HIP','RIGHT_KNEE','RIGHT_ANKLE'],['left_elbow','LEFT_SHOULDER','LEFT_ELBOW','LEFT_WRIST'],
    ['right_elbow','RIGHT_SHOULDER','RIGHT_ELBOW','RIGHT_WRIST'],['right_spine','RIGHT_SHOULDER','RIGHT_HIP','RIGHT_KNEE'],
  ]
  const result: Record<string, number> = {}
  TRIPLETS.forEach(([id, a, b, c]) => {
    const angles = recent.map(frame => {
      const lm: Record<string, {x:number,y:number}> = {}
      LANDMARK_NAMES.forEach((name, i) => { if (frame[i]) lm[name] = frame[i] })
      const A = lm[a], B = lm[b], C = lm[c]
      if (!A || !B || !C) return null
      return computeAngle(A, B, C)
    }).filter((x): x is number => x !== null)
    if (angles.length > 0) result[id] = angles.sort((a,b) => a-b)[Math.floor(angles.length/2)]
  })
  return result
}
