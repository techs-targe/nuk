// グローバル変数
let originalText = '';
let blackoutRanges = [];

// DOM要素の取得
const inputText = document.getElementById('inputText');
const loadTextBtn = document.getElementById('loadText');
const textDisplay = document.getElementById('textDisplay');
const applyBlackoutBtn = document.getElementById('applyBlackout');
const resetBtn = document.getElementById('resetText');
const downloadBtn = document.getElementById('downloadImage');

// イベントリスナーの設定
loadTextBtn.addEventListener('click', loadText);
applyBlackoutBtn.addEventListener('click', applyBlackout);
resetBtn.addEventListener('click', resetText);
downloadBtn.addEventListener('click', downloadAsImage);

// テキスト選択時にボタンを有効化
textDisplay.addEventListener('mouseup', handleSelection);
textDisplay.addEventListener('touchend', handleSelection);

// テキストを読み込む
function loadText() {
    const text = inputText.value.trim();
    if (!text) {
        alert('テキストを入力してください');
        return;
    }

    originalText = text;
    blackoutRanges = [];
    renderText();

    applyBlackoutBtn.disabled = true;
    resetBtn.disabled = false;
    downloadBtn.disabled = false;
}

// テキストを表示
function renderText() {
    if (!originalText) {
        textDisplay.innerHTML = '';
        return;
    }

    // 黒塗り範囲をソート
    blackoutRanges.sort((a, b) => a.start - b.start);

    let html = '';
    let lastIndex = 0;

    blackoutRanges.forEach(range => {
        // 通常のテキスト
        html += escapeHtml(originalText.substring(lastIndex, range.start));
        // 黒塗り部分
        html += `<span class="blackout">${escapeHtml(originalText.substring(range.start, range.end))}</span>`;
        lastIndex = range.end;
    });

    // 残りのテキスト
    html += escapeHtml(originalText.substring(lastIndex));

    textDisplay.innerHTML = html;
}

// テキスト選択の処理
function handleSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString();

    if (selectedText && textDisplay.contains(selection.anchorNode)) {
        applyBlackoutBtn.disabled = false;
    } else {
        applyBlackoutBtn.disabled = true;
    }
}

// 黒塗りを適用
function applyBlackout() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);

    // 選択範囲がtextDisplay内かチェック
    if (!textDisplay.contains(range.commonAncestorContainer)) {
        alert('テキスト表示エリア内の文字を選択してください');
        return;
    }

    // 選択されたテキストの位置を計算
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(textDisplay);
    preCaretRange.setEnd(range.startContainer, range.startOffset);

    const start = getTextLength(preCaretRange);
    const end = start + selection.toString().length;

    // 範囲を追加（重複チェック）
    const overlapping = blackoutRanges.some(r =>
        (start >= r.start && start < r.end) ||
        (end > r.start && end <= r.end) ||
        (start <= r.start && end >= r.end)
    );

    if (!overlapping) {
        blackoutRanges.push({ start, end });
        renderText();
    }

    // 選択を解除
    selection.removeAllRanges();
    applyBlackoutBtn.disabled = true;
}

// テキストの長さを計算（黒塗りタグを無視）
function getTextLength(range) {
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(range.cloneContents());

    // 黒塗りクラスのspanを通常テキストに変換
    const blackouts = tempDiv.querySelectorAll('.blackout');
    blackouts.forEach(span => {
        span.replaceWith(span.textContent);
    });

    return tempDiv.textContent.length;
}

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// リセット
function resetText() {
    blackoutRanges = [];
    renderText();
    applyBlackoutBtn.disabled = true;
}

// 画像としてダウンロード
async function downloadAsImage() {
    try {
        // html2canvasの代わりにCanvas APIを使用
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // キャンバスのサイズを設定
        const padding = 40;
        const lineHeight = 30;
        const fontSize = 18;
        const maxWidth = 800;

        ctx.font = `${fontSize}px Arial, sans-serif`;

        // テキストを行に分割
        const lines = wrapText(ctx, originalText, maxWidth - padding * 2);

        canvas.width = maxWidth;
        canvas.height = lines.length * lineHeight + padding * 2;

        // 背景を白に
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // テキストを描画
        ctx.fillStyle = 'black';
        ctx.font = `${fontSize}px Arial, sans-serif`;

        let charIndex = 0;
        lines.forEach((line, lineIndex) => {
            const y = padding + (lineIndex + 1) * lineHeight;
            let x = padding;

            for (let char of line) {
                const isBlackout = blackoutRanges.some(range =>
                    charIndex >= range.start && charIndex < range.end
                );

                if (isBlackout) {
                    ctx.fillStyle = 'black';
                    const charWidth = ctx.measureText(char).width;
                    ctx.fillRect(x, y - fontSize, charWidth, fontSize + 4);
                } else {
                    ctx.fillStyle = 'black';
                    ctx.fillText(char, x, y);
                }

                x += ctx.measureText(char).width;
                charIndex++;
            }

            // 改行文字もカウント
            if (lineIndex < lines.length - 1) {
                charIndex++;
            }
        });

        // ダウンロード
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'blackout-text.png';
            a.click();
            URL.revokeObjectURL(url);
        });

    } catch (error) {
        console.error('ダウンロードエラー:', error);
        alert('画像のダウンロードに失敗しました');
    }
}

// テキストを行に分割
function wrapText(ctx, text, maxWidth) {
    const lines = [];
    const paragraphs = text.split('\n');

    paragraphs.forEach(paragraph => {
        if (!paragraph) {
            lines.push('');
            return;
        }

        let line = '';
        for (let char of paragraph) {
            const testLine = line + char;
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && line) {
                lines.push(line);
                line = char;
            } else {
                line = testLine;
            }
        }
        lines.push(line);
    });

    return lines;
}
