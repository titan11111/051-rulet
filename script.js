// ゲーム状態管理
class RouletteGame {
    constructor() {
        this.items = [];
        this.canvas = document.getElementById('rouletteCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isSpinning = false;
        this.currentRotation = 0;
        this.audioContext = null;
        this.audioEnabled = false;
        
        // 要素の取得
        this.itemInput = document.getElementById('itemInput');
        this.addBtn = document.getElementById('addBtn');
        this.spinBtn = document.getElementById('spinBtn');
        this.currentItems = document.getElementById('currentItems');
        this.result = document.getElementById('result');
        
        this.init();
    }
    
    init() {
        // イベントリスナーの設定
        this.addBtn.addEventListener('click', () => this.addItem());
        this.itemInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addItem();
            }
        });
        this.spinBtn.addEventListener('click', () => this.spin());
        
        // iPhoneでの音声再生のために最初のタッチで音声コンテキストを初期化
        document.addEventListener('touchstart', () => this.initAudio(), { once: true });
        document.addEventListener('click', () => this.initAudio(), { once: true });
        
        // 初期描画
        this.drawRoulette();
        this.updateItemsList();
        
        // デフォルト項目を追加（デモ用）
        this.items = ['りんご', 'みかん', 'ばなな'];
        this.updateDisplay();
    }
    
    // 音声コンテキストの初期化（iPhone対応）
    async initAudio() {
        if (!this.audioEnabled) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                await this.audioContext.resume();
                this.audioEnabled = true;
                console.log('音声が有効になりました');
            } catch (error) {
                console.log('音声の初期化に失敗しました:', error);
            }
        }
    }
    
    // 効果音の生成と再生
    playSound(frequency, duration, type = 'sine') {
        if (!this.audioEnabled || !this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = type;
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        } catch (error) {
            console.log('音声再生エラー:', error);
        }
    }
    
    // 回転音の再生
    playSpinSound() {
        if (!this.audioEnabled) return;
        
        let frequency = 200;
        const interval = setInterval(() => {
            this.playSound(frequency, 0.1, 'sawtooth');
            frequency += 10;
            if (frequency > 800) frequency = 200;
        }, 100);
        
        setTimeout(() => {
            clearInterval(interval);
        }, 3000);
    }
    
    // 結果音の再生
    playResultSound() {
        if (!this.audioEnabled) return;
        
        // ファンファーレ風の音
        setTimeout(() => this.playSound(523, 0.2), 0);    // C
        setTimeout(() => this.playSound(659, 0.2), 200);  // E
        setTimeout(() => this.playSound(784, 0.2), 400);  // G
        setTimeout(() => this.playSound(1047, 0.4), 600); // C
    }
    
    // 項目を追加
    addItem() {
        const text = this.itemInput.value.trim();
        if (text && !this.items.includes(text)) {
            if (this.items.length < 12) { // 最大12項目
                this.items.push(text);
                this.itemInput.value = '';
                this.updateDisplay();
                this.playSound(440, 0.1); // 追加音
            } else {
                alert('項目は最大12個までです！');
            }
        } else if (this.items.includes(text)) {
            alert('同じ項目は追加できません！');
        }
    }
    
    // 項目を削除
    removeItem(index) {
        this.items.splice(index, 1);
        this.updateDisplay();
        this.playSound(330, 0.1); // 削除音
    }
    
    // 表示を更新
    updateDisplay() {
        this.drawRoulette();
        this.updateItemsList();
        this.spinBtn.disabled = this.items.length < 2;
    }
    
    // 項目リストを更新
    updateItemsList() {
        this.currentItems.innerHTML = '';
        
        if (this.items.length === 0) {
            this.currentItems.innerHTML = '<p style="color: #666;">まだ項目がありません</p>';
            return;
        }
        
        this.items.forEach((item, index) => {
            const tag = document.createElement('div');
            tag.className = 'item-tag';
            tag.innerHTML = `
                ${item}
                <button class="remove-btn" onclick="rouletteGame.removeItem(${index})">×</button>
            `;
            this.currentItems.appendChild(tag);
        });
    }
    
    // ルーレットを描画
    drawRoulette() {
        const canvas = this.canvas;
        const ctx = this.ctx;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;
        
        // キャンバスをクリア
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (this.items.length === 0) {
            // 項目がない場合の表示
            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#666';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('項目を追加してね！', centerX, centerY);
            return;
        }
        
        // 色のパレット
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
            '#BB8FCE', '#85C1E9', '#82E0AA', '#F8C471'
        ];
        
        const anglePerItem = (Math.PI * 2) / this.items.length;
        
        // 各セクションを描画
        this.items.forEach((item, index) => {
            const startAngle = index * anglePerItem + this.currentRotation;
            const endAngle = startAngle + anglePerItem;
            
            // セクションを塗りつぶし
            ctx.fillStyle = colors[index % colors.length];
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fill();
            
            // 境界線を描画
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.stroke();
            
            // テキストを描画
            const textAngle = startAngle + anglePerItem / 2;
            const textRadius = radius * 0.7;
            const textX = centerX + Math.cos(textAngle) * textRadius;
            const textY = centerY + Math.sin(textAngle) * textRadius;
            
            ctx.save();
            ctx.translate(textX, textY);
            ctx.rotate(textAngle + Math.PI / 2);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 2;
            ctx.fillText(item, 0, 0);
            ctx.restore();
        });
        
        // 中央の円
        ctx.fillStyle = '#2d3748';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎯', centerX, centerY);
    }
    
    // ルーレットを回す
    spin() {
        if (this.isSpinning || this.items.length < 2) return;
        
        this.isSpinning = true;
        this.spinBtn.disabled = true;
        this.result.className = 'result';
        this.result.innerHTML = '';
        
        // 回転音を再生
        this.playSpinSound();
        
        // 回転の計算
        const spins = 5 + Math.random() * 5; // 5-10回転
        const finalAngle = Math.random() * Math.PI * 2;
        const totalRotation = spins * Math.PI * 2 + finalAngle;
        
        const startTime = Date.now();
        const duration = 3000; // 3秒
        const startRotation = this.currentRotation;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // イージング関数（徐々に遅くなる）
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            this.currentRotation = startRotation + totalRotation * easeOut;
            this.drawRoulette();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // 回転終了
                this.finishSpin(finalAngle);
            }
        };
        
        animate();
    }
    
    // 回転終了処理
    finishSpin(finalAngle) {
        this.isSpinning = false;
        this.spinBtn.disabled = false;
        
        // 結果を計算（ポインターの位置から逆算）
        const anglePerItem = (Math.PI * 2) / this.items.length;
        const normalizedAngle = (Math.PI * 2 - (finalAngle % (Math.PI * 2))) % (Math.PI * 2);
        const selectedIndex = Math.floor(normalizedAngle / anglePerItem);
        const winner = this.items[selectedIndex];
        
        // 結果を表示
        setTimeout(() => {
            this.result.className = 'result show';
            this.result.innerHTML = `🎉 結果: <strong>${winner}</strong> 🎉`;
            this.playResultSound();
        }, 500);
    }
}

// ゲームを開始
let rouletteGame;
document.addEventListener('DOMContentLoaded', () => {
    rouletteGame = new RouletteGame();
});
