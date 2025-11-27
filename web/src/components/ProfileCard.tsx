import React from 'react';
import { Profile } from '../types';

interface ProfileCardProps {
  profile: Profile;
  onClick?: () => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ profile, onClick }) => {
  const formatFollowers = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const getCountryDisplay = (country?: string | string[]): string => {
    if (!country) return 'Unknown';

    // 배열인 경우
    if (Array.isArray(country)) {
      return country.length > 0 ? String(country[0]) : 'Unknown';
    }

    // 문자열이 아닌 경우
    if (typeof country !== 'string') {
      return 'Unknown';
    }

    // 배열 형태의 문자열인 경우 (예: "['Korea', 'Japan']")
    if (country.startsWith('[') && country.endsWith(']')) {
      try {
        const parsed = JSON.parse(country.replace(/'/g, '"'));
        return Array.isArray(parsed) && parsed.length > 0 ? String(parsed[0]) : 'Unknown';
      } catch {
        return country;
      }
    }

    // 쉼표로 구분된 경우 (예: "Korea, Japan")
    if (country.includes(',')) {
      return country.split(',')[0].trim();
    }

    return country;
  };

  const getPlatformIcon = (platform: string): string => {
    switch (platform.toLowerCase()) {
      // SNS 플랫폼
      case 'instagram': return '📷';
      case 'youtube': return '▶️';
      case 'tiktok': return '🎵';
      case 'twitter': return '🐦';
      case 'x': return '🐦';
      case 'facebook': return '📘';
      case 'linkedin': return '💼';
      case 'snapchat': return '👻';
      // 블로그 플랫폼
      case 'blog': return '📝';
      case 'naver': return '📝';
      case 'tistory': return '📝';
      case 'medium': return '📝';
      case 'brunch': return '📝';
      // 메신저 플랫폼
      case 'kakaotalk': return '💛';
      case 'kakao': return '💛';
      case 'whatsapp': return '💬';
      case 'telegram': return '✈️';
      // 쇼핑 플랫폼
      case 'shopee': return '🛍️';
      case 'amazon': return '📦';
      case 'shopltk': return '🛒';
      case 'rakuten': return '🏪';
      case 'sephora': return '💄';
      case 'coupang': return '🚀';
      // 기타
      default: return '🔗';
    }
  };

  return (
    <div className="profile-card" onClick={onClick}>
      <div
        className="profile-background"
        style={{ backgroundImage: `url(${profile.primaryImage || 'https://via.placeholder.com/300x400'})` }}
      >
        <div className="profile-overlay">
          <div className="profile-region">
            <span className="region-badge">{getCountryDisplay(profile.country)}</span>
          </div>

          <div className="profile-actions">
            {profile.links && profile.links.slice(0, 3).map((link, idx) => (
              <button
                key={idx}
                className="action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  window.openai?.openExternal({ href: link.urls[0] });
                }}
                title={link.platform}
              >
                {getPlatformIcon(link.platform)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="profile-info">
        <h4
          className="username"
          onClick={(e) => {
            e.stopPropagation();
            window.openai?.openExternal({ href: `https://www.instagram.com/${profile.username}` });
          }}
        >
          @{profile.username}
        </h4>
        <p className="title">{profile.title || 'Creator'}</p>
        <p className="followers">
          <span className="followers-icon">👤</span>
          <span className="followers-count">{formatFollowers(profile.followed_by)}</span>
        </p>
      </div>
    </div>
  );
};

export default ProfileCard;
