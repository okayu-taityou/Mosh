// SNS投稿の管理（バックエンド連携版）
document.addEventListener('DOMContentLoaded', function() {
    const postsContainer = document.getElementById('posts-container');
    
    if (postsContainer) {
        // 初期投稿の読み込み
        loadPosts();
        
        // 30秒おきに新しい投稿をチェック
        setInterval(loadPosts, 30000);
    }
    
    // 投稿読み込み関数
    async function loadPosts() {
        try {
            showLoadingPosts();
            
            const response = await fetch('/api/sns/posts?limit=20');
            const data = await response.json();
            
            hideLoadingPosts();
            
            if (data.success && data.data.length > 0) {
                displayPosts(data.data);
                showNotification('投稿を読み込みました');
            } else {
                showErrorMessage('投稿の読み込みに失敗しました');
            }
        } catch (error) {
            hideLoadingPosts();
            console.error('投稿の読み込みエラー:', error);
            showErrorMessage('ネットワークエラーが発生しました');
        }
    }
    
    // ローディング表示
    function showLoadingPosts() {
        if (!postsContainer) return;
        
        postsContainer.innerHTML = `
            <div class="loading-posts">
                <i class="fas fa-spinner fa-spin"></i>
                <p>投稿を読み込み中...</p>
            </div>
        `;
    }
    
    // ローディング非表示
    function hideLoadingPosts() {
        const loading = document.querySelector('.loading-posts');
        if (loading) {
            loading.remove();
        }
    }
    
    // 投稿表示関数
    function displayPosts(posts) {
        if (!postsContainer) return;
        
        // 既存の投稿をクリア
        postsContainer.innerHTML = '';
        
        posts.forEach(post => {
            const postElement = createPostElement(post);
            postsContainer.appendChild(postElement);
        });
    }
    
    // 投稿要素作成
    function createPostElement(post) {
        const postDiv = document.createElement('div');
        postDiv.className = 'post-item';
        postDiv.setAttribute('data-post-id', post.id);
        
        const platformIcon = getPlatformIcon(post.platform);
        
        postDiv.innerHTML = `
            <div class="post-header">
                <div class="post-platform ${post.platform}">
                    <i class="${platformIcon}"></i>
                </div>
                <div class="post-meta">
                    <div class="post-author">${post.author}</div>
                    <div class="post-time" title="${post.formatted_date || post.created_at}">${post.created_at}</div>
                </div>
            </div>
            <div class="post-content">${post.content}</div>
            ${post.image_url ? `<img src="${post.image_url}" alt="投稿画像" class="post-image" onerror="this.style.display='none'">` : ''}
            <div class="post-engagement">
                <span onclick="updateEngagement(${post.id}, 'likes')" class="engagement-btn likes-btn">
                    <i class="fas fa-heart"></i> <span class="count">${post.likes_count}</span>
                </span>
                <span onclick="updateEngagement(${post.id}, 'comments')" class="engagement-btn comments-btn">
                    <i class="fas fa-comment"></i> <span class="count">${post.comments_count}</span>
                </span>
                <span onclick="updateEngagement(${post.id}, 'shares')" class="engagement-btn shares-btn">
                    <i class="fas fa-share"></i> <span class="count">${post.shares_count}</span>
                </span>
            </div>
        `;
        
        return postDiv;
    }
    
    // プラットフォームアイコン取得
    function getPlatformIcon(platform) {
        const icons = {
            'instagram': 'fab fa-instagram',
            'twitter': 'fab fa-twitter',
            'facebook': 'fab fa-facebook'
        };
        return icons[platform] || 'fas fa-share-alt';
    }
    
    // エンゲージメント更新（グローバル関数として定義）
    window.updateEngagement = async function(postId, type) {
        const button = document.querySelector(`[data-post-id="${postId}"] .${type}-btn`);
        
        // ボタンの無効化
        if (button) {
            button.style.pointerEvents = 'none';
            button.style.opacity = '0.6';
        }
        
        try {
            const response = await fetch(`/api/sns/posts/${postId}/engagement`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ type, increment: 1 })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 該当する投稿の表示を更新
                updatePostEngagementDisplay(postId, data.data);
                
                // 視覚的フィードバック
                showEngagementFeedback(postId, type);
            } else {
                showErrorMessage('いいねに失敗しました');
            }
        } catch (error) {
            console.error('エンゲージメント更新エラー:', error);
            showErrorMessage('ネットワークエラーが発生しました');
        } finally {
            // ボタンの有効化
            if (button) {
                button.style.pointerEvents = 'auto';
                button.style.opacity = '1';
            }
        }
    };
    
    // 投稿のエンゲージメント表示更新
    function updatePostEngagementDisplay(postId, engagementData) {
        const postElement = document.querySelector(`[data-post-id="${postId}"]`);
        if (!postElement) return;
        
        const likesCount = postElement.querySelector('.likes-btn .count');
        const commentsCount = postElement.querySelector('.comments-btn .count');
        const sharesCount = postElement.querySelector('.shares-btn .count');
        
        if (likesCount) likesCount.textContent = engagementData.likes_count;
        if (commentsCount) commentsCount.textContent = engagementData.comments_count;
        if (sharesCount) sharesCount.textContent = engagementData.shares_count;
    }
    
    // エンゲージメントフィードバック表示
    function showEngagementFeedback(postId, type) {
        const postElement = document.querySelector(`[data-post-id="${postId}"]`);
        if (!postElement) return;
        
        const feedback = document.createElement('div');
        feedback.className = 'engagement-feedback';
        feedback.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--primary-color);
            color: white;
            padding: 10px 20px;
            border-radius: 50px;
            font-size: 0.9rem;
            z-index: 100;
            animation: feedbackPop 1s ease-out forwards;
            box-shadow: 0 4px 15px rgba(0, 188, 212, 0.3);
        `;
        
        const messages = {
            'likes': '❤️ いいね！',
            'comments': '💬 コメント',
            'shares': '🔄 シェア'
        };
        
        feedback.textContent = messages[type] || '👍 リアクション';
        
        postElement.style.position = 'relative';
        postElement.appendChild(feedback);
        
        setTimeout(() => {
            feedback.remove();
        }, 1000);
    }
    
    // 新しい投稿を模擬的に生成（テスト用）
    window.generateMockPost = async function() {
        try {
            showNotification('新しい投稿を生成中...');
            
            const response = await fetch('/api/sns/generate-mock-post', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 投稿を再読み込み
                await loadPosts();
                showNotification('新しい投稿が追加されました！');
            } else {
                showErrorMessage('投稿の生成に失敗しました');
            }
        } catch (error) {
            console.error('模擬投稿生成エラー:', error);
            showErrorMessage('投稿生成でエラーが発生しました');
        }
    };
    
    // 通知表示
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = 'sns-notification';
        
        const bgColor = type === 'error' ? '#f44336' : 'var(--primary-color)';
        const icon = type === 'error' ? 'fas fa-exclamation-triangle' : 'fas fa-bell';
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        notification.innerHTML = `
            <i class="${icon}" style="margin-right: 10px;"></i>
            ${message}
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }
    
    // エラーメッセージ表示
    function showErrorMessage(message) {
        showNotification(message, 'error');
    }
    
    // CSSアニメーションの追加
    const style = document.createElement('style');
    style.textContent = `
        @keyframes feedbackPop {
            0% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.5);
            }
            50% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1.2);
            }
            100% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(1);
            }
        }
        
        @keyframes slideOut {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(100px);
            }
        }
        
        .engagement-btn {
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .engagement-btn:hover {
            transform: scale(1.1);
            color: var(--primary-color);
        }
        
        .engagement-btn:active {
            transform: scale(0.95);
        }
    `;
    document.head.appendChild(style);
});