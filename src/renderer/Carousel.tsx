import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
// Import modules from 'swiper' for broader compatibility with versions
import { Autoplay } from 'swiper';

export type CarouselHandle = {
  slideNext: () => void;
  slidePrev: () => void;
  goTo: (idx: number) => void;
  startAutoplay: () => void;
  stopAutoplay: () => void;
};

interface Props {
  children: React.ReactNode[];
  height?: number | string;
  autoplayDelay?: number;
  loop?: boolean;
  aspectRatio?: number; // accepted but not used by Swiper; kept for compatibility
  freeMode?: boolean; // will be passed to Swiper freeMode prop
}

const Carousel = forwardRef<CarouselHandle, Props>(({ children, height = '33vh', autoplayDelay = 2400, loop = true, aspectRatio, freeMode }, ref) => {
  const swiperRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    slideNext: () => swiperRef.current?.slideNext?.(),
    slidePrev: () => swiperRef.current?.slidePrev?.(),
    goTo: (idx: number) => swiperRef.current?.slideTo?.(idx),
    startAutoplay: () => swiperRef.current?.autoplay?.start?.(),
    stopAutoplay: () => swiperRef.current?.autoplay?.stop?.(),
  }), []);

  // Ensure there are enough slides to fill slidesPerView when looping so neighbors appear
  const slidesPerView = 3;
  let slidesToRender: React.ReactNode[] = children || [];
  if (loop && slidesToRender.length > 0 && slidesToRender.length < slidesPerView) {
    // repeat until we have at least slidesPerView items
    const out: React.ReactNode[] = [];
    while (out.length < slidesPerView) {
      out.push(...slidesToRender);
    }
    slidesToRender = out.slice(0, Math.max(slidesPerView, slidesToRender.length));
  }

  // Note: Swiper handles loop cloning internally. Avoid manually appending the
  // first slide to prevent visible duplicates when loop is enabled.

  return (
    <div style={{ width: '100%', height: typeof height === 'number' ? `${height}px` : height }}>
      <Swiper
        onSwiper={(s) => { swiperRef.current = s; }}
  slidesPerView={'auto'}
  spaceBetween={6}
        centeredSlides={true}
        loop={loop}
        autoplay={{ delay: autoplayDelay, disableOnInteraction: false }}
  freeMode={!!freeMode}
  modules={[Autoplay]}
        style={{ width: '100%', height: '100%' }}
      >
        {slidesToRender.map((c, i) => (
          <SwiperSlide key={i} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            {/* Use aspect-ratio to force a 16:9 card while being responsive. */}
            {/* Responsive width: use a percentage of viewport with a sensible max to scale on large screens */}
            <div style={{ width: '60%', maxWidth: 840, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden', borderRadius: 8 }}>
                {c}
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
});

export default Carousel;
