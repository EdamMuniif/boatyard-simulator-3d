// Stylized visual rigging profile for the game. This is not a force,
// capacity, cable tension, sling-placement, or operator-training model.
export const SLING_STATIONS = Object.freeze([-10.2,-3.4,3.4,10.2]);
export const SLING_SEGMENTS = 36;
export const SLING_HALF_SPAN = 8.5;
export const SLING_WEB_WIDTH = 0.43;
export function rigPose(liftHeight,attached){
  const h = Math.min(6.25,Math.max(0,Number.isFinite(liftHeight)?liftHeight:0));
  // Open slings hang nearly to pavement, while loaded slings cradle the hull.
  const blockY = 12.65 + h * .50;
  return {blockY,topY:blockY-.75,bottomY:attached?h-1.68:.24};
}
export function slingPoint(t,pose){
  const u=Math.min(1,Math.max(0,t));
  const normalized=Math.abs(u*2-1);
  return {
    x:(u*2-1)*SLING_HALF_SPAN,
    y:pose.bottomY+(pose.topY-pose.bottomY)*Math.pow(normalized,2.55)
  };
}
