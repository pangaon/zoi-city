#include "support-types.h"
#include <react/renderer/textlayoutmanager/TextMeasureCache.h>
#include <cassert>
#include <iostream>
using namespace facebook::react;
TextMeasureCacheKey key(int tag,float scale,std::string text="Hellenic Community of Ottawa"){
 TextMeasureCacheKey k;
 AttributedString::Fragment f;f.string=text;f.parentShadowView.tag=tag;f.textAttributes.fontSizeMultiplier=scale;
 k.attributedString.fragments.push_back(f);return k;
}
int main(){
 TextMeasureCache cache;int measured=0;
 auto measure=[&](){++measured;TextMeasurement m;m.size={100,float(20*measured)};return m;};
 auto one=key(100,1),remounted=key(200,1),two=key(300,2);
 assert(one==remounted);
 assert(std::hash<TextMeasureCacheKey>{}(one)==std::hash<TextMeasureCacheKey>{}(remounted));
 assert(!(one==two));
 assert(std::hash<TextMeasureCacheKey>{}(one)!=std::hash<TextMeasureCacheKey>{}(two));
 cache.get(one,measure);cache.get(remounted,measure);assert(measured==1);
 cache.get(two,measure);assert(measured==2);
 cache.get(key(400,2),measure);assert(measured==2);
 cache.get(key(500,1.3f),measure);assert(measured==3);
 cache.get(key(600,1),measure);assert(measured==3);
 // Nested text fragments have the same scale-sensitive identity.
 auto nested=two;nested.attributedString.fragments.push_back(key(700,2,"nested").attributedString.fragments[0]);
 auto nestedOld=nested;nestedOld.attributedString.fragments[1].textAttributes.fontSizeMultiplier=1;
 assert(!(nested==nestedOld));
 assert(std::hash<TextMeasureCacheKey>{}(nested)!=std::hash<TextMeasureCacheKey>{}(nestedOld));
 // Constraint and real text changes retain their existing cache separation.
 auto width=two;width.layoutConstraints.width=300;assert(!(width==two));
 assert(!(key(800,2,"different") == two));
 std::cout<<"{\"actual_RN_headers\":true,\"host_remount_cache_hit\":true,\"font_field_cache_miss\":true,\"same_scale_hit\":true,\"scale_return_hit\":true,\"nested_field_split\":true,\"measurement_calls\":"<<measured<<"}\n";
}
