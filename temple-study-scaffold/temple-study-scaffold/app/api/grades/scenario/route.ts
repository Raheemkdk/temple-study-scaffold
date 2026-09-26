
import { calculateRequiredAverage } from '@/lib/grades/scenario';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json();
  const { target, earnedPoints, remainingWeight } = body;

  if (
    typeof target !== 'number' ||
    typeof earnedPoints !== 'number' ||
    typeof remainingWeight !== 'number'
  ) {
    return Response.json(
      { error: 'All grade inputs must be numbers' },
      { status: 400 }
    );
  }

  if (remainingWeight < 0 || remainingWeight > 100) {
    return Response.json(
      { error: 'Remaining weight must be between 0 and 100' },
      { status: 400 }
    );
  }

  if (
    !Number.isFinite(target) ||
    !Number.isFinite(earnedPoints) ||
    !Number.isFinite(remainingWeight)
  ) {
    return Response.json(
      { error: 'Grade inputs must be finite numbers' },
      { status: 400 }
    );
  }

  if (
    target < 0 ||
    target > 100 ||
    earnedPoints < 0 ||
    earnedPoints > 100 - remainingWeight
  ) {
    return Response.json(
      { error: 'Grade inputs are outside the valid range' },
      { status: 400 }
    );
  }

  if (remainingWeight === 0) {
    const finalGrade = earnedPoints;
    const status = finalGrade >= target ? 'achieved' : 'unreachable';
    return Response.json({ requiredAverage: null, status, finalGrade });
  }

  const requiredAverage = calculateRequiredAverage(
    target,
    earnedPoints,
    remainingWeight
  );

  let status: 'achieved' | 'unreachable' | 'possible';

  if (earnedPoints >= target) {
    status = 'achieved';
  } else if (target - earnedPoints > remainingWeight) {
    status = 'unreachable';
  } else {
    status = 'possible';
  }

  return Response.json({ requiredAverage, status });
}