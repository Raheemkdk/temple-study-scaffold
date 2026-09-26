// TODO: Owner 2: pure weighted-grade calculation and boundary cases.
// See README.md and docs/ for acceptance criteria.
export function calculateRequiredAverage(
    target: number, 
    earnedPoints: number,
    remainingWeight: number

): number | null {
    if(remainingWeight == 0){
        return null;
    }
    const fractionRemaining = remainingWeight / 100
    const pointsNeeded = target - earnedPoints
    return pointsNeeded / fractionRemaining
}

