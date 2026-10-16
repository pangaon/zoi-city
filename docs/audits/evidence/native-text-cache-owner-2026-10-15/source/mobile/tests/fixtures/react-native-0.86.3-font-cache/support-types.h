// Test-only structural substitutes for RN's attributed strings/geometry.
// The cache, hash, equality and float-comparison functions under test are the
// complete unmodified RN headers. This is not a renderer or measurement mock.
#pragma once
#include <concepts>
#include <functional>
#include <optional>
#include <string>
#include <tuple>
#include <vector>
namespace folly {class dynamic;}
namespace facebook::react {
using Float=float;
struct Size {float width=0,height=0;bool operator==(const Size&) const=default;};
struct Rect {Size size;bool operator==(const Rect&) const=default;};
struct TextAttributes {
 std::string fontFamily="system";
 float fontSize=14,fontSizeMultiplier=1,letterSpacing=0,lineHeight=20;
 std::optional<int> fontWeight,fontStyle,fontVariant,dynamicTypeRamp,alignment;
 std::optional<bool> allowFontScaling=true;
 bool operator==(const TextAttributes&)const=default;
};
struct AttributedString {
 struct Fragment {
  std::string string;TextAttributes textAttributes;
  struct ShadowView{int tag=0;int layoutMetrics=0;} parentShadowView;
  bool attachment=false;
  bool isAttachment()const{return attachment;}
  bool isContentEqual(const Fragment& b)const{return string==b.string&&textAttributes==b.textAttributes;}
 };
 std::vector<Fragment> fragments;
 const std::vector<Fragment>&getFragments()const{return fragments;}
};
struct ParagraphAttributes {int numberOfLines=0;bool operator==(const ParagraphAttributes&)const=default;};
struct LayoutConstraints {float width=390,height=1000;bool operator==(const LayoutConstraints&)const=default;};
}
namespace std {
template<>struct hash<facebook::react::TextAttributes>{size_t operator()(const facebook::react::TextAttributes& x)const{return hash<float>{}(x.fontSizeMultiplier);}};
template<>struct hash<facebook::react::ParagraphAttributes>{size_t operator()(const facebook::react::ParagraphAttributes& x)const{return hash<int>{}(x.numberOfLines);}};
template<>struct hash<facebook::react::LayoutConstraints>{size_t operator()(const facebook::react::LayoutConstraints& x)const{return hash<float>{}(x.width)^hash<float>{}(x.height);}};
template<>struct hash<facebook::react::Size>{size_t operator()(const facebook::react::Size& x)const{return hash<float>{}(x.width)^hash<float>{}(x.height);}};
}
