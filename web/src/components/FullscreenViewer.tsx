import React from 'react';
import { useMaxHeight } from '../hooks/useMaxHeight';
import { Profile } from '../types';
import ProfileCard from './ProfileCard';

interface FullscreenViewerProps {
  profiles: Profile[];
  initialIndex?: number;
  onClose: () => void;
}

const FullscreenViewer: React.FC<FullscreenViewerProps> = ({
  profiles,
  initialIndex = 0,
  onClose,
}) => {
  const maxHeight = useMaxHeight() ?? undefined;
  const [index, setIndex] = React.useState(initialIndex);

  React.useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  const profile = profiles[index];

  // Debug: log profile data
  React.useEffect(() => {
    console.log('=== PROFILE DATA DEBUG ===');
    console.log('Profile:', profile);
    console.log('follows:', profile.follows);
    console.log('media_count:', profile.media_count);
    console.log('followed_by:', profile.followed_by);
    console.log('========================');
  }, [profile]);

  // Get all images for the current profile (grid images only)
  const allImages = React.useMemo(() => {
    console.log('=== PROFILE IMAGE DEBUG ===');
    console.log('Profile username:', profile.username);
    console.log('Grid images:', profile.gridImages);
    console.log('Grid images count:', profile.gridImages?.length || 0);
    console.log('Primary image:', profile.primaryImage);

    const images: string[] = [];
    // Only grid images
    if (profile.gridImages && profile.gridImages.length > 0) {
      console.log('Using GRID IMAGES');
      images.push(...profile.gridImages);
    }
    // Fallback to primary image only if no grid images
    if (images.length === 0 && profile.primaryImage) {
      console.log('FALLBACK: Using primary image (no grid images found)');
      images.push(profile.primaryImage);
    }

    console.log('Final images array:', images);
    console.log('=========================');
    return images;
  }, [profile]);

  const formatFollowers = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const getCountryDisplay = (country?: string | string[]): string => {
    if (!country) return 'Unknown';
    if (Array.isArray(country)) {
      return country.length > 0 ? String(country[0]) : 'Unknown';
    }
    if (typeof country !== 'string') {
      return 'Unknown';
    }
    if (country.startsWith('[') && country.endsWith(']')) {
      try {
        const parsed = JSON.parse(country.replace(/'/g, '"'));
        return Array.isArray(parsed) && parsed.length > 0 ? String(parsed[0]) : 'Unknown';
      } catch {
        return country;
      }
    }
    if (country.includes(',')) {
      return country.split(',')[0].trim();
    }
    return country;
  };

  const getPlatformIcon = (platform: string): string => {
    switch (platform.toLowerCase()) {
      case 'instagram': return '📷';
      case 'youtube': return '▶️';
      case 'tiktok': return '🎵';
      case 'twitter': return '🐦';
      case 'x': return '🐦';
      case 'facebook': return '📘';
      case 'blog': return '📝';
      case 'naver': return '📝';
      case 'kakaotalk': return '💛';
      case 'kakao': return '💛';
      default: return '🔗';
    }
  };

  return (
    <div
      className="fullscreen-viewer split-layout"
      style={{
        maxHeight,
        height: maxHeight,
      }}
    >
      {/* Header Bar */}
      <div className="split-header">
        <div className="split-logo">WHOTAG</div>
        <button className="split-close-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {/* Main Content */}
      <div className="split-content">
        {/* Left: Profile List Sidebar */}
        <div className="profile-list-sidebar">
          <div className="profile-list-header">
            <h3 className="profile-list-title">인플루언서</h3>
            <span className="profile-list-count">{profiles.length}명</span>
          </div>
          <div className="profile-list-scroll">
            {profiles.map((p, i) => (
              <div
                key={p.user_id}
                className={`profile-card-wrapper ${i === index ? 'active' : ''}`}
                onClick={() => setIndex(i)}
              >
                <ProfileCard profile={p} />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Detail Panel (2 columns) */}
        <div className="detail-panel-container">
          {/* Column 1: Grid Image */}
          <div className="detail-grid-column">
            <div className="grid-image-container">
              <img
                src={allImages[0] || profile.primaryImage || 'https://via.placeholder.com/600x800'}
                alt={profile.full_name}
                className="grid-image-full"
              />
            </div>
          </div>

          {/* Column 2: Profile Info */}
          <div className="detail-info-column">
            <div className="detail-info-scroll">
              {/* Profile Header */}
              <div className="detail-profile-header">
                <div className="detail-avatar">
                  <div
                    className="detail-avatar-image"
                    style={{ backgroundImage: `url(${profile.primaryImage || 'https://via.placeholder.com/80'})` }}
                  />
                </div>
                <div className="detail-profile-text">
                  <h2 className="detail-username">@{profile.username}</h2>
                  <p className="detail-fullname">{profile.full_name}</p>
                  <span className="detail-country">{getCountryDisplay(profile.country)}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="detail-stats">
                <div className="detail-stat-item">
                  <div className="detail-stat-value">{formatFollowers(profile.followed_by)}</div>
                  <div className="detail-stat-label">Followers</div>
                </div>
                {profile.follows !== undefined && (
                  <div className="detail-stat-item">
                    <div className="detail-stat-value">{formatFollowers(profile.follows)}</div>
                    <div className="detail-stat-label">Following</div>
                  </div>
                )}
                {profile.media_count !== undefined && (
                  <div className="detail-stat-item">
                    <div className="detail-stat-value">{formatFollowers(profile.media_count)}</div>
                    <div className="detail-stat-label">Posts</div>
                  </div>
                )}
              </div>

              {/* Bio/Description */}
              {(profile.biography || profile.demo_short || profile.description) && (
                <div className="detail-section">
                  <h3 className="detail-section-title">About</h3>
                  <p className="detail-bio">{profile.biography || profile.demo_short || profile.description}</p>
                </div>
              )}

              {/* Key Metrics */}
              <div className="detail-section">
                <h3 className="detail-section-title">Key Metrics</h3>
                <div className="detail-metrics-grid">
                  {profile.engagement_rate !== undefined && (
                    <div className="metric-card">
                      <div className="metric-label">Engagement Rate</div>
                      <div className="metric-value">{(profile.engagement_rate * 100).toFixed(2)}%</div>
                      {profile.engagement_rate_tag && (
                        <div className="metric-tag">{profile.engagement_rate_tag}</div>
                      )}
                    </div>
                  )}
                  {profile.viral_reach_rate !== undefined && (
                    <div className="metric-card">
                      <div className="metric-label">Viral Reach Rate</div>
                      <div className="metric-value">{(profile.viral_reach_rate * 100).toFixed(2)}%</div>
                      {profile.viral_reach_rate_tag && (
                        <div className="metric-tag">{profile.viral_reach_rate_tag}</div>
                      )}
                    </div>
                  )}
                  {profile.category_name && (
                    <div className="metric-card">
                      <div className="metric-label">Category</div>
                      <div className="metric-value-text">{profile.category_name}</div>
                    </div>
                  )}
                  {profile.account_type && (
                    <div className="metric-card">
                      <div className="metric-label">Account Type</div>
                      <div className="metric-value-text">{profile.account_type}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Demographics */}
              <div className="detail-section">
                <h3 className="detail-section-title">Demographics</h3>
                <div className="detail-info-grid">
                  {profile.gender && (
                    <div className="info-grid-item">
                      <span className="info-grid-label">Gender</span>
                      <span className="info-grid-value">{profile.gender}</span>
                    </div>
                  )}
                  {profile.age_range && (
                    <div className="info-grid-item">
                      <span className="info-grid-label">Age Range</span>
                      <span className="info-grid-value">{profile.age_range}</span>
                    </div>
                  )}
                  {profile.language && profile.language.length > 0 && (
                    <div className="info-grid-item">
                      <span className="info-grid-label">Languages</span>
                      <div className="info-grid-tags">
                        {profile.language.slice(0, 3).map((lang, idx) => (
                          <span key={idx} className="info-mini-tag">{lang}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.ethnicity && (
                    <div className="info-grid-item">
                      <span className="info-grid-label">Ethnicity</span>
                      <span className="info-grid-value">{profile.ethnicity}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Lifestyle */}
              {(profile.occupation || profile.marital_status || profile.lifestage || profile.personality?.length) && (
                <div className="detail-section">
                  <h3 className="detail-section-title">Lifestyle</h3>
                  <div className="detail-info-list">
                    {profile.occupation && (
                      <div className="info-list-item">
                        <span className="info-list-label">Occupation:</span>
                        <span className="info-list-value">{profile.occupation}</span>
                      </div>
                    )}
                    {profile.marital_status && (
                      <div className="info-list-item">
                        <span className="info-list-label">Marital Status:</span>
                        <span className="info-list-value">
                          {profile.marital_status}
                          {profile.has_children && ' • Has Children'}
                        </span>
                      </div>
                    )}
                    {profile.lifestage && (
                      <div className="info-list-item">
                        <span className="info-list-label">Life Stage:</span>
                        <span className="info-list-value">{profile.lifestage}</span>
                      </div>
                    )}
                    {profile.personality && profile.personality.length > 0 && (
                      <div className="info-list-item">
                        <span className="info-list-label">Personality:</span>
                        <div className="detail-tags">
                          {profile.personality.slice(0, 4).map((p, idx) => (
                            <span key={idx} className="detail-tag">{p}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Brand Collaboration */}
              <div className="detail-section">
                <h3 className="detail-section-title">Brand Collaboration</h3>

                {/* Collaboration Status */}
                <div className="collab-status-row">
                  {profile.collaboration_tier && (
                    <div className="collab-badge tier-badge">{profile.collaboration_tier}</div>
                  )}
                  {profile.willing_to_collaborate !== undefined && (
                    <div className={`collab-badge ${profile.willing_to_collaborate ? 'willing' : 'not-willing'}`}>
                      {profile.willing_to_collaborate ? '✓ Open to Collaborate' : '✗ Not Available'}
                    </div>
                  )}
                </div>

                {/* Brand Keywords */}
                {profile.keywords_for_brand && profile.keywords_for_brand.length > 0 && (
                  <div className="detail-tag-group">
                    <span className="detail-tag-label">Brand Keywords:</span>
                    <div className="detail-tags">
                      {profile.keywords_for_brand.slice(0, 8).map((keyword, idx) => (
                        <span key={idx} className="detail-tag brand-keyword">{keyword}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Collaborated Brands */}
                {profile.collaborate_brand && profile.collaborate_brand.length > 0 && (
                  <div className="detail-tag-group">
                    <span className="detail-tag-label">Past Collaborations:</span>
                    <div className="detail-tags">
                      {profile.collaborate_brand.slice(0, 6).map((brand, idx) => (
                        <span key={idx} className="detail-tag collab-brand">{brand}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tagged Brands */}
                {profile.tag_brand && profile.tag_brand.length > 0 && (
                  <div className="detail-tag-group">
                    <span className="detail-tag-label">Tagged Brands:</span>
                    <div className="detail-tags">
                      {profile.tag_brand.slice(0, 6).map((brand, idx) => (
                        <span key={idx} className="detail-tag">{brand}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Collaboration Points */}
                {profile.note_for_brand_collaborate_point && profile.note_for_brand_collaborate_point.length > 0 && (
                  <div className="collab-notes">
                    <div className="collab-notes-label">✓ Strengths:</div>
                    <ul className="collab-notes-list">
                      {profile.note_for_brand_collaborate_point.slice(0, 4).map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Weak Points */}
                {profile.note_for_brand_weak_point && profile.note_for_brand_weak_point.length > 0 && (
                  <div className="collab-notes weak">
                    <div className="collab-notes-label">⚠ Considerations:</div>
                    <ul className="collab-notes-list">
                      {profile.note_for_brand_weak_point.slice(0, 4).map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Special Attributes */}
                <div className="special-attributes">
                  {profile.luxury_consumption && (
                    <span className="special-badge luxury">💎 Luxury Consumer</span>
                  )}
                  {profile.kinterest && (
                    <span className="special-badge kinterest">🇰🇷 K-Culture Interest</span>
                  )}
                </div>
              </div>

              {/* Content & Interests */}
              <div className="detail-section">
                <h3 className="detail-section-title">Content & Interests</h3>

                {profile.field_of_creator && profile.field_of_creator.length > 0 && (
                  <div className="detail-tag-group">
                    <span className="detail-tag-label">Creator Field:</span>
                    <div className="detail-tags">
                      {profile.field_of_creator.slice(0, 6).map((field, idx) => (
                        <span key={idx} className="detail-tag">{field}</span>
                      ))}
                    </div>
                  </div>
                )}

                {profile.interests && profile.interests.length > 0 && (
                  <div className="detail-tag-group">
                    <span className="detail-tag-label">Interests:</span>
                    <div className="detail-tags">
                      {profile.interests.slice(0, 8).map((interest, idx) => (
                        <span key={idx} className="detail-tag">{interest}</span>
                      ))}
                    </div>
                  </div>
                )}

                {profile.content_hashtags && profile.content_hashtags.length > 0 && (
                  <div className="detail-tag-group">
                    <span className="detail-tag-label">Content Hashtags:</span>
                    <div className="detail-tags">
                      {profile.content_hashtags.slice(0, 10).map((tag, idx) => (
                        <span key={idx} className="detail-tag hashtag">#{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {profile.bio_hashtags && profile.bio_hashtags.length > 0 && (
                  <div className="detail-tag-group">
                    <span className="detail-tag-label">Bio Hashtags:</span>
                    <div className="detail-tags">
                      {profile.bio_hashtags.slice(0, 6).map((tag, idx) => (
                        <span key={idx} className="detail-tag hashtag">#{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Social Links */}
              {profile.links && profile.links.length > 0 && (
                <div className="detail-section">
                  <h3 className="detail-section-title">Social Channels</h3>
                  <div className="detail-social-links">
                    {profile.links.map((link, idx) => (
                      <button
                        key={idx}
                        className="detail-social-btn"
                        onClick={() => window.openai?.openExternal({ href: link.urls[0] })}
                        title={link.platform}
                      >
                        <span className="detail-social-icon">{getPlatformIcon(link.platform)}</span>
                        <span className="detail-social-name">{link.platform}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="detail-cta">
                <button
                  className="detail-cta-btn"
                  onClick={() => window.openai?.openExternal({ href: 'https://whotag.ai' })}
                >
                  View Full Profile on WHOTAG
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullscreenViewer;
