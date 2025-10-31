// グローバル変数
let canvas, ctx;
let image = null;
let blackoutRects = [];
let isDrawing = false;
let startX, startY;
let currentRect = null;
let cameraStream = null;

// DOM要素
const uploadArea = document.getElementById('uploadArea');
const imageInput = document.getElementById('imageInput');
const editorSection = document.getElementById('editorSection');
const imageCanvas = document.getElementById('imageCanvas');
const undoBtn = document.getElementById('undoBtn');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');
const newImageBtn = document.getElementById('newImageBtn');

// Camera elements
const cameraBtn = document.getElementById('cameraBtn');
const cameraModal = document.getElementById('cameraModal');
const cameraVideo = document.getElementById('cameraVideo');
const cameraCanvas = document.getElementById('cameraCanvas');
const captureBtn = document.getElementById('captureBtn');
const closeCameraBtn = document.getElementById('closeCameraBtn');
const cancelCameraBtn = document.getElementById('cancelCameraBtn');

// Popup elements
const evianPopup = document.getElementById('evianPopup');
const closePopupBtn = document.getElementById('closePopupBtn');
const loadingOverlay = document.getElementById('loadingOverlay');

// 初期化
function init() {
    canvas = imageCanvas;
    ctx = canvas.getContext('2d');

    // イベントリスナー設定
    uploadArea.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', handleImageUpload);

    // ドラッグ&ドロップ
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);

    // キャンバスイベント
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // タッチイベント
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);

    // ボタンイベント
    undoBtn.addEventListener('click', undoLastBlackout);
    resetBtn.addEventListener('click', resetBlackouts);
    downloadBtn.addEventListener('click', downloadImage);
    newImageBtn.addEventListener('click', loadNewImage);

    // Camera events
    cameraBtn.addEventListener('click', openCamera);
    closeCameraBtn.addEventListener('click', closeCamera);
    cancelCameraBtn.addEventListener('click', closeCamera);
    captureBtn.addEventListener('click', capturePhoto);

    // Popup events
    closePopupBtn.addEventListener('click', closeEvianPopup);
}

// ============ Camera Functions ============

async function openCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false
        });
        cameraVideo.srcObject = cameraStream;
        cameraModal.classList.add('show');
    } catch (error) {
        console.error('カメラエラー:', error);
        alert('カメラにアクセスできませんでした。カメラの許可を確認してください。');
    }
}

function closeCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    cameraModal.classList.remove('show');
}

function capturePhoto() {
    const context = cameraCanvas.getContext('2d');

    // Set canvas size to video size
    cameraCanvas.width = cameraVideo.videoWidth;
    cameraCanvas.height = cameraVideo.videoHeight;

    // Draw video frame to canvas
    context.drawImage(cameraVideo, 0, 0);

    // Convert canvas to blob
    cameraCanvas.toBlob(blob => {
        closeCamera();
        loadImageFromBlob(blob);
    }, 'image/jpeg', 0.95);
}

// ============ OCR Functions ============

async function detectEvian(imageElement) {
    showLoading(true);

    try {
        const { data: { text } } = await Tesseract.recognize(
            imageElement,
            'eng',
            {
                logger: info => console.log(info)
            }
        );

        console.log('OCR結果:', text);

        // Check if "evian" exists in the text (case-insensitive)
        if (text.toLowerCase().includes('evian')) {
            showEvianPopup();
        }
    } catch (error) {
        console.error('OCRエラー:', error);
    } finally {
        showLoading(false);
    }
}

function showEvianPopup() {
    evianPopup.classList.add('show');
}

function closeEvianPopup() {
    evianPopup.classList.remove('show');
}

function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

// ============ Image Upload Functions ============

// ドラッグオーバー
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
}

// ドラッグリーブ
function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
}

// ドロップ
function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            loadImageFromFile(file);
        } else {
            alert('画像ファイルを選択してください');
        }
    }
}

// 画像アップロード処理
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 10 * 1024 * 1024) {
            alert('ファイルサイズは10MB以下にしてください');
            return;
        }
        loadImageFromFile(file);
    }
}

// ファイルから画像を読み込む
function loadImageFromFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        loadImageFromDataURL(e.target.result);
    };
    reader.readAsDataURL(file);
}

// Blobから画像を読み込む
function loadImageFromBlob(blob) {
    const reader = new FileReader();
    reader.onload = function(e) {
        loadImageFromDataURL(e.target.result);
    };
    reader.readAsDataURL(blob);
}

// Data URLから画像を読み込む
function loadImageFromDataURL(dataURL) {
    image = new Image();
    image.onload = function() {
        setupCanvas();
        document.querySelector('.input-section').style.display = 'none';
        editorSection.style.display = 'block';

        // Run OCR to detect "evian"
        detectEvian(image);
    };
    image.src = dataURL;
}

// ============ Canvas Functions ============

// キャンバスのセットアップ
function setupCanvas() {
    blackoutRects = [];

    // キャンバスサイズを画像に合わせる
    const maxWidth = 900;
    const maxHeight = 700;

    let width = image.width;
    let height = image.height;

    // 最大サイズに収まるようにリサイズ
    if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
    }
    if (height > maxHeight) {
        width = (maxHeight / height) * width;
        height = maxHeight;
    }

    canvas.width = width;
    canvas.height = height;

    redrawCanvas();
}

// キャンバスを再描画
function redrawCanvas() {
    // 画像を描画
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // 黒塗りを描画
    ctx.fillStyle = '#000000';
    blackoutRects.forEach(rect => {
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    });

    // 現在描画中の矩形
    if (currentRect) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(currentRect.x, currentRect.y, currentRect.width, currentRect.height);
    }
}

// ============ Drawing Functions ============

// 描画開始
function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
}

// 描画中
function draw(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const width = currentX - startX;
    const height = currentY - startY;

    currentRect = {
        x: width < 0 ? currentX : startX,
        y: height < 0 ? currentY : startY,
        width: Math.abs(width),
        height: Math.abs(height)
    };

    redrawCanvas();
}

// 描画終了
function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;

    if (currentRect && currentRect.width > 5 && currentRect.height > 5) {
        blackoutRects.push(currentRect);
    }

    currentRect = null;
    redrawCanvas();
}

// ============ Touch Functions ============

// タッチ開始
function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();

    isDrawing = true;
    startX = touch.clientX - rect.left;
    startY = touch.clientY - rect.top;
}

// タッチ移動
function handleTouchMove(e) {
    e.preventDefault();
    if (!isDrawing) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;

    const width = currentX - startX;
    const height = currentY - startY;

    currentRect = {
        x: width < 0 ? currentX : startX,
        y: height < 0 ? currentY : startY,
        width: Math.abs(width),
        height: Math.abs(height)
    };

    redrawCanvas();
}

// タッチ終了
function handleTouchEnd(e) {
    e.preventDefault();
    if (!isDrawing) return;
    isDrawing = false;

    if (currentRect && currentRect.width > 5 && currentRect.height > 5) {
        blackoutRects.push(currentRect);
    }

    currentRect = null;
    redrawCanvas();
}

// ============ Edit Functions ============

// 最後の黒塗りを取り消す
function undoLastBlackout() {
    if (blackoutRects.length > 0) {
        blackoutRects.pop();
        redrawCanvas();
    }
}

// すべてリセット
function resetBlackouts() {
    if (confirm('すべての黒塗りをリセットしますか？')) {
        blackoutRects = [];
        redrawCanvas();
    }
}

// 画像をダウンロード
function downloadImage() {
    // 最終的な画像を作成
    const downloadCanvas = document.createElement('canvas');
    downloadCanvas.width = canvas.width;
    downloadCanvas.height = canvas.height;
    const downloadCtx = downloadCanvas.getContext('2d');

    // 画像と黒塗りを描画
    downloadCtx.drawImage(image, 0, 0, canvas.width, canvas.height);
    downloadCtx.fillStyle = '#000000';
    blackoutRects.forEach(rect => {
        downloadCtx.fillRect(rect.x, rect.y, rect.width, rect.height);
    });

    // ダウンロード
    downloadCanvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'evian-blackout-' + Date.now() + '.png';
        a.click();
        URL.revokeObjectURL(url);
    }, 'image/png');
}

// 新しい画像を読み込む
function loadNewImage() {
    if (blackoutRects.length > 0) {
        if (!confirm('現在の編集内容は失われます。続けますか？')) {
            return;
        }
    }

    document.querySelector('.input-section').style.display = 'block';
    editorSection.style.display = 'none';
    imageInput.value = '';
    image = null;
    blackoutRects = [];
}

// 初期化実行
init();
