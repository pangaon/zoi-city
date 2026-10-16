import {useState} from 'react';
import {Pressable,StyleSheet,useColorScheme,View} from 'react-native';
import {ScaleText as Text} from './ScaleText';
import type {NativeServiceOfferings,ServiceDetail} from './serviceOfferings';
type Appearance={background:string;ink:string;muted:string;accent:string;surface:string;line:string};

/** Read-only published details. Booking/availability remain separate capabilities. */
export function ServiceOfferings({offerings,appearance}:{offerings:NativeServiceOfferings;appearance?:Appearance}){
 const[limit,setLimit]=useState(12),dark=useColorScheme()==='dark';
 const ink=appearance?.ink||(dark?'#F1F6FA':'#163449'),secondary=appearance?.muted||(dark?'#B9CCD9':'#4F6472'),border=appearance?.line||(dark?'#446071':'#C8D8E2'),surface=appearance?.surface||(dark?'#102A3B':'#F7FAFC'),card=appearance?.background||(dark?'#19394D':'#FFFFFF'),accent=appearance?.accent||(dark?'#78B2E8':'#17629A');
 const detail=(item:ServiceDetail)=><><View style={s.detailHeading}><Text selectable accessibilityRole="header" style={[s.name,{color:ink}]}>{item.name}</Text>{item.price?<Text selectable style={[s.price,{color:ink}]}>{item.price}</Text>:null}</View>{item.duration?<Text selectable style={[s.note,{color:secondary}]}>{item.duration}</Text>:null}{item.description?<Text selectable style={[s.body,{color:secondary}]}>{item.description}</Text>:null}</>;
 if(!offerings.items.length&&!offerings.bounded)return null;
 return <View testID="service-offerings" style={[s.panel,{backgroundColor:surface,borderColor:border}]}>
 {offerings.items.slice(0,limit).map((item,index)=><View key={index} style={[s.card,{borderColor:border,backgroundColor:card}]}>{detail(item)}{item.options.length?<View style={s.options}><Text accessibilityRole="header" style={[s.body,{color:ink,fontWeight:'600'}]}>Options</Text>{item.options.map((option,i)=><View key={i} style={[s.option,{borderColor:border}]}>{detail(option)}</View>)}</View>:null}{item.optionsBounded?<Text style={[s.note,{color:secondary}]}>More options may be available on their website.</Text>:null}</View>)}
 {offerings.items.length?<Text accessibilityLiveRegion="polite" style={[s.note,{color:secondary}]}>{Math.min(limit,offerings.items.length)} of {offerings.total} services</Text>:null}
 {limit<offerings.items.length?<Pressable accessibilityRole="button" onPress={()=>setLimit(n=>n+12)} style={[s.button,{borderColor:accent,backgroundColor:card}]}><Text style={[s.body,{color:accent,fontWeight:'600'}]}>Show {Math.min(12,offerings.items.length-limit)} more services</Text></Pressable>:null}
 {offerings.bounded?<Text style={[s.note,{color:secondary}]}>More services may be available on their website.</Text>:null}
 {offerings.origin==='source'?<Text style={[s.note,{color:secondary}]}>These details have not been confirmed by the owner.</Text>:null}
 </View>;
}
const s=StyleSheet.create({panel:{gap:10,minWidth:0,padding:14,borderRadius:20,borderWidth:1},detailHeading:{flexDirection:'row',flexWrap:'wrap',alignItems:'flex-start',gap:8},price:{fontSize:14,lineHeight:20,fontWeight:'600',maxWidth:'100%',flexShrink:1},card:{borderWidth:1,borderRadius:14,padding:13,gap:6,minWidth:0},name:{fontSize:16,lineHeight:22,fontWeight:'600',flexShrink:1,flexGrow:1,flexBasis:160},body:{fontSize:14,lineHeight:21,flexShrink:1},options:{gap:8,marginTop:2},option:{borderTopWidth:1,paddingTop:8,gap:5,minWidth:0},note:{fontSize:12,lineHeight:17,flexShrink:1},button:{borderWidth:1,borderRadius:20,minHeight:44,minWidth:48,padding:11,justifyContent:'center',alignSelf:'flex-start',flexShrink:1,maxWidth:'100%'}});
