import React, { useRef } from 'react';
import ProfileCard from './ProfileCard';

interface CarouselProps {
  profiles: Array<{
    user_id: string;
    username: string;
    full_name: string;
    title: string;
    followed_by: number;
    primaryImage?: string;
    country?: string | string[];
    links?: Array<{
      platform: string;
      urls: string[];
    }>;
  }>;
}

const Carousel: React.FC<CarouselProps> = ({ profiles }) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (trackRef.current) {
      const cardWidth = 280 + 16; // card width + gap
      trackRef.current.scrollBy({ left: -cardWidth * 2, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (trackRef.current) {
      const cardWidth = 280 + 16; // card width + gap
      trackRef.current.scrollBy({ left: cardWidth * 2, behavior: 'smooth' });
    }
  };

  return (
    <div className="carousel-container">
      <button
        className="carousel-btn carousel-btn-prev"
        onClick={scrollLeft}
        aria-label="Previous"
      >
        ‹
      </button>

      <div className="carousel-track" ref={trackRef}>
        {profiles.map((profile) => (
          <ProfileCard key={profile.user_id} profile={profile} />
        ))}
      </div>

      <button
        className="carousel-btn carousel-btn-next"
        onClick={scrollRight}
        aria-label="Next"
      >
        ›
      </button>
    </div>
  );
};

export default Carousel;
