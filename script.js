const mapLayer = document.querySelector(".map-layer");
const container = document.querySelector(".map-container");
const meMarker = document.querySelector(".me-marker");
const targetMarker = document.querySelector(".target-marker");
const distanceLabel = document.querySelector(".distance-label");
const measurementLine = document.querySelector(".measurement-line");



let pointStage = 0;

let pointA = null;
let pointB = null;

let scale = 1;
let targetScale = 1;

let isDragging = false;
let hasDragged = false;

let startX = 0;
let startY = 0;

let mouseDownX = 0;
let mouseDownY = 0;

let offsetX = 0;
let offsetY = 0;


/* 화면 프레임에 맞춰 지도 업데이트 */
let animationFrameRequested = false;

function requestTransformUpdate() {
  if (animationFrameRequested) return;

  animationFrameRequested = true;

  requestAnimationFrame(() => {
    updateTransform();
    animationFrameRequested = false;
  });
}

/* 지도 위치/확대 적용 */
function updateTransform() {
  clampOffset();

  mapLayer.style.setProperty("--map-scale", scale);

  mapLayer.style.transform =
    `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
 
    updateDistanceLabelPosition();

}


/* 거리 박스를 선 중앙의 화면 위치에 맞춤 */
function updateDistanceLabelPosition() {
  if (!pointA || !pointB) return;

  const mapRect = mapLayer.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  const midX = (pointA.x + pointB.x) / 2;
  const midY = (pointA.y + pointB.y) / 2;

  const screenX =
    mapRect.left -
    containerRect.left +
    midX * mapRect.width;

  const screenY =
    mapRect.top -
    containerRect.top +
    midY * mapRect.height;

  distanceLabel.style.left = `${screenX}px`;
  distanceLabel.style.top = `${screenY}px`;
}


/* 지도를 화면 밖으로 너무 밀어버리지 못하게 제한 */
function clampOffset() {
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  const baseWidth = mapLayer.clientWidth;
  const baseHeight = mapLayer.clientHeight;

  const mapWidth = baseWidth * scale;
  const mapHeight = baseHeight * scale;

  const maxOffsetX = Math.max(
    0,
    (mapWidth - containerWidth) / 2
  );

  const maxOffsetY = Math.max(
    0,
    (mapHeight - containerHeight) / 2
  );

  offsetX = Math.min(
    Math.max(offsetX, -maxOffsetX),
    maxOffsetX
  );

  offsetY = Math.min(
    Math.max(offsetY, -maxOffsetY),
    maxOffsetY
  );
}

/* POI 마커 생성 */
function createPoiMarker(type, x, y, id) {
  const marker = document.createElement("div");

  marker.className = "poi-marker";
  marker.dataset.type = type;
  marker.dataset.id = id;

  marker.style.left = `${x * 100}%`;
  marker.style.top = `${y * 100}%`;

  const icon = document.createElement("div");
  icon.className = "poi-marker-icon";

  if (type === "car") {
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="
          M7 3
          H17
          L19 8
          L20 18
          H17
          V21
          H14
          V18
          H10
          V21
          H7
          V18
          H4
          L5 8
          Z
          M8 5
          L6.5 9
          H17.5
          L16 5
          Z
          M7 12
          A2 2 0 1 0 7 16
          A2 2 0 1 0 7 12
          M17 12
          A2 2 0 1 0 17 16
          A2 2 0 1 0 17 12
        " />
      </svg>
    `;
  }

if (type === "glider") {
  icon.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <!-- 왼쪽 삼각 날개 -->
      <path d="
        M2 5
        L20 5
        L13 12
        Z
      "/>

      <!-- 오른쪽 삼각 날개 -->
      <path d="
        M20 5
        L20 21
        L13 12
        Z
      "/>

      <!-- 중앙 행글라이더 프레임 -->
      <path
        d="
          M13 12
          L9 13.5
          L13 18
          L15 13
          Z
        "
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linejoin="round"
      />
    </svg>
  `;
}

if (type === "secretRoom") {
  icon.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="
        M8 3
        A5 5 0 1 0 8 13
        A5 5 0 0 0 8 3

        M8 6
        A2 2 0 1 1 8 10
        A2 2 0 0 1 8 6

        M12 9
        H22
        V12
        H19
        V15
        H16
        V12
        H12
        Z
      " />
    </svg>
  `;
}

if (type === "gasStation") {
  icon.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="
        M5 2
        H15
        V21
        H5
        Z

        M7 4
        V9
        H13
        V4
        Z

        M15 6
        H18
        L21 9
        V18
        A3 3 0 0 1 18 21
        H17
        V18
        H18
        V10
        L16 8
        H15
        Z
      " />
    </svg>
  `;
}

  marker.appendChild(icon);
  mapLayer.appendChild(marker);
}

/* 공개판은 브라우저 저장값보다 배포된 JSON을 항상 사용한다. */
async function loadPoiData() {
  try {
    const response = await fetch("./taego-poi-data.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`POI JSON: HTTP ${response.status}`);
    const data = await response.json();
    for (const type of ["car", "glider", "secretRoom", "gasStation"]) {
      if (!Array.isArray(data[type])) throw new Error(`Invalid POI group: ${type}`);
      for (const poi of data[type]) {
        createPoiMarker(type, poi.x, poi.y, poi.id);
      }
    }
  } catch (error) {
    console.error("Failed to load POI data:", error);
  }
}

/* 마우스 위치 중심 부드러운 줌 */
let zoomAnimationId = null;
let zoomMouseX = 0;
let zoomMouseY = 0;

mapLayer.addEventListener("wheel", (event) => {
  event.preventDefault();

  const containerRect =
    container.getBoundingClientRect();

  zoomMouseX =
    event.clientX -
    containerRect.left -
    containerRect.width / 2;

  zoomMouseY =
    event.clientY -
    containerRect.top -
    containerRect.height / 2;

  if (event.deltaY < 0) {
    targetScale *= 1.35;
  } else {
    targetScale /= 1.35;
  }

  targetScale = Math.min(
    Math.max(targetScale, 1),
    8
  );

  if (!zoomAnimationId) {
    animateZoom();
  }
});

function animateZoom() {
  const difference =
    targetScale - scale;

  if (Math.abs(difference) < 0.001) {
    scale = targetScale;
    updateTransform();

    zoomAnimationId = null;
    return;
  }

  const oldScale = scale;

  /* 목표 배율을 부드럽게 따라감 */
  scale += difference * 0.22;

  const scaleRatio =
    scale / oldScale;

  offsetX =
    zoomMouseX -
    (zoomMouseX - offsetX) * scaleRatio;

  offsetY =
    zoomMouseY -
    (zoomMouseY - offsetY) * scaleRatio;

  updateTransform();

  zoomAnimationId =
    requestAnimationFrame(animateZoom);
}

/* 마우스 누르기 */
mapLayer.addEventListener("mousedown", (event) => {

  event.preventDefault();

  if (event.button !== 0) return;

  isDragging = true;
  hasDragged = false;

  mouseDownX = event.clientX;
  mouseDownY = event.clientY;

  startX = event.clientX - offsetX;
  startY = event.clientY - offsetY;

  mapLayer.style.cursor = "crosshair";
});


/* 지도 드래그 */
window.addEventListener("mousemove", (event) => {
  if (!isDragging) return;

  const moveX =
    event.clientX - mouseDownX;

  const moveY =
    event.clientY - mouseDownY;

  if (Math.hypot(moveX, moveY) > 5) {
    hasDragged = true;
  }

  offsetX =
    event.clientX - startX;

  offsetY =
    event.clientY - startY;

  requestTransformUpdate();
});


/* 마우스 놓기 / 클릭이면 ME 마커 찍기 */
window.addEventListener("mouseup", (event) => {
  if (!isDragging) return;

  isDragging = false;
  mapLayer.style.cursor = "crosshair";

  if (hasDragged) return;

  const rect =
    mapLayer.getBoundingClientRect();

  const x =
    event.clientX - rect.left;

  const y =
    event.clientY - rect.top;

  const percentX =
    x / rect.width;

  const percentY =
    y / rect.height;

  if (
    percentX < 0 ||
    percentX > 1 ||
    percentY < 0 ||
    percentY > 1
  ) {
    return;
  }
  if (event.button !== 0) return;


if (pointStage === 0) {

  // 첫 번째 클릭 = 내 위치

  meMarker.style.left =
    `${percentX * 100}%`;

  meMarker.style.top =
    `${percentY * 100}%`;

  meMarker.style.display = "block";

  pointA = {
  x: percentX,
  y: percentY
};
  
  pointStage = 1;

} else if (pointStage === 1) {

  // 두 번째 클릭 = 목표 위치

  targetMarker.style.left =
    `${percentX * 100}%`;

  targetMarker.style.top =
    `${percentY * 100}%`;

  targetMarker.style.display = "block";

  pointB = {
  x: percentX,
  y: percentY
};

measurementLine.setAttribute("x1", `${pointA.x * 100}%`);
measurementLine.setAttribute("y1", `${pointA.y * 100}%`);
measurementLine.setAttribute("x2", `${pointB.x * 100}%`);
measurementLine.setAttribute("y2", `${pointB.y * 100}%`);

measurementLine.style.display = "block";

const mapSizeMeters = 8160;

const dx = (pointB.x - pointA.x) * mapSizeMeters;
const dy = (pointB.y - pointA.y) * mapSizeMeters;

const distance = Math.sqrt(
  dx * dx + dy * dy
);


distanceLabel.textContent = `${Math.round(distance)} m`;
distanceLabel.style.display = "block";

updateDistanceLabelPosition();

  pointStage = 2;

}
});


/* 우클릭 = 점 초기화 */
mapLayer.addEventListener("contextmenu", (event) => {

  event.preventDefault();
  meMarker.style.display = "none";
  targetMarker.style.display = "none";
  distanceLabel.style.display = "none";
  measurementLine.style.display = "none";

  pointA = null;
  pointB = null;

  pointStage = 0;

});

/* 창 크기가 바뀌면 지도 중앙 정리 */
window.addEventListener("resize", () => {
  offsetX = 0;
  offsetY = 0;

  updateTransform();
});


/* 일반 사용자 POI 표시 토글 */
document
  .querySelectorAll("[data-poi-toggle]")
  .forEach((toggle) => {

    toggle.addEventListener("change", () => {
      const type =
        toggle.dataset.poiToggle;

      document
        .querySelectorAll(
          `.poi-marker[data-type="${type}"]`
        )
        .forEach((marker) => {
          marker.style.display =
            toggle.checked ? "block" : "none";
        });
    });

  });

loadPoiData();
updateTransform();