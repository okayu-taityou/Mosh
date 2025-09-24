// 試合結果ページの機能

document.addEventListener('DOMContentLoaded', function() {
    // トーナメントタブの切り替え
    const tournamentTabs = document.querySelectorAll('[data-tournament]');
    const tournamentContents = document.querySelectorAll('.tournament-tab');
    
    tournamentTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTournament = this.getAttribute('data-tournament');
            
            // アクティブタブの切り替え
            tournamentTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // コンテンツの切り替え
            tournamentContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetTournament) {
                    content.classList.add('active');
                }
            });
        });
    });
    
    // ランキングタブの切り替え
    const rankingTabs = document.querySelectorAll('[data-ranking]');
    const rankingContents = document.querySelectorAll('.ranking-tab');
    
    rankingTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetRanking = this.getAttribute('data-ranking');
            
            // アクティブタブの切り替え
            rankingTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // コンテンツの切り替え
            rankingContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetRanking) {
                    content.classList.add('active');
                }
            });
        });
    });
    
    // 統計数値のアニメーション
    const animateNumbers = () => {
        const statNumbers = document.querySelectorAll('.stat-number');
        
        statNumbers.forEach(stat => {
            const finalNumber = stat.textContent.replace('%', '');
            const isPercentage = stat.textContent.includes('%');
            const duration = 2000;
            const increment = finalNumber / (duration / 16);
            let currentNumber = 0;
            
            const timer = setInterval(() => {
                currentNumber += increment;
                if (currentNumber >= finalNumber) {
                    currentNumber = finalNumber;
                    clearInterval(timer);
                }
                
                if (isPercentage) {
                    stat.textContent = Math.floor(currentNumber) + '%';
                } else {
                    stat.textContent = Math.floor(currentNumber);
                }
            }, 16);
        });
    };
    
    // スクロール時の統計アニメーション
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateNumbers();
                observer.disconnect();
            }
        });
    });
    
    const statsSection = document.querySelector('.stats-overview');
    if (statsSection) {
        observer.observe(statsSection);
    }
});