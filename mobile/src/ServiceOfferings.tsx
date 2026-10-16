import {useState} from 'react';
import {Pressable,StyleSheet,useColorScheme,View} from 'react-native';
import {ScaleText as Text} from './ScaleText';
import type {NativeServiceOfferings,ServiceDetail} from './serviceOfferings';
type Appearance={background:string;ink:string;muted:string;accent:string;surface:string;line:string};

/** Read-only published details. Booking/availability remain separate capabilities. */
export function ServiceOfferings({offerings,appearance}:{offerings:NativeServiceOfferings;appearance?:Appearance}){
 const[limit,setLimit]=useState(4),[expanded,setExpanded]=useState<Record<number,boolean>>({}),dark=useColorScheme()==='dark';
 const ink=appearance?.ink||(dark?'#F1F6FA':'#163449'),secondary=appearance?.muted||(dark?'#B9CCD9':'#4F6472'),border=appearance?.line||(dark?'#446071':'#C8D8E2'),surface=appearance?.surface||(dark?'#102A3B':'#F7FAFC'),card=appearance?.background||(dark?'#19394D':'#FFFFFF'),accent=appearance?.accent||(dark?'#78B2E8':'#17629A');
 const detail=(item:ServiceDetail)=><><View style={s.detailHeading}><Text selectable accessibilityRole="header" style={[s.name,{color:ink}]}>{item.name}</Text>{item.price?<Text selectable style={[s.price,{color:ink}]}>{item.price}</Text>:null}</View>{item.duration?<Text selectable style={[s.note,{color:secondary}]}>{item.duration}</Text>:null}{item.description?<Text selectable numberOfLines={2} style={[s.body,{color:secondary}]}>{item.description}</Text>:null}</>;
 if(!offerings.items.length&&!offerings.bounded)return null;
 return <View testID="service-offerings" style={[s.panel,{backgroundColor:surface,borderColor:border}]}>
 {offerings.items.slice(0,limit).map((item,index)=>{const showAll=!!expanded[index],visibleOptions=showAll?item.options:item.options.slice(0,2);return <View key={index} style={[s.card,{borderColor:border,backgroundColor:card}]}>{detail(item)}{item.options.length?<View style={s.options}>{visibleOptions.map((option,i)=><View key={i} style={[s.option,{borderColor:border}]}>{detail(option)}</View>)}{item.options.length>2?<Pressable accessibilityRole="button" onPress={()=>setExpanded(old=>({...old,[index]:!old[index]}))} style={s.inlineButton}><Text style={[s.note,{color:accent,fontWeight:'600'}]}>{showAll?'Show fewer options':`See ${item.options.length-2} more options`}</Text></Pressable>:null}</View>:null}</View>})}
 {offerings.items.length>limit?<Pressable accessibilityRole="button" onPress={()=>setLimit(n=>n+4)} style={[s.button,{borderColor:accent,backgroundColor:card}]}><Text style={[s.body,{color:accent,fontWeight:'600'}]}>Show {Math.min(4,offerings.items.length-limit)} more</Text></Pressable>:null}
 {offerings.bounded?<Text style={[s.note,{color:secondary}]}>More services may be available on their website.</Text>:null}
 </View>;
}
const s=StyleSheet.create({panel:{gap:9,minWidth:0,padding:10,borderRadius:18,borderWidth:1},detailHeading:{flexDirection:'row',flexWrap:'wrap',alignItems:'flex-start',gap:7},price:{fontSize:13,lineHeight:18,fontWeight:'600',maxWidth:'100%',flexShrink:1},card:{borderWidth:1,borderRadius:13,padding:11,gap:5,minWidth:0},name:{fontSize:15,lineHeight:20,fontWeight:'600',flexShrink:1,flexGrow:1,flexBasis:160},body:{fontSize:13,lineHeight:18,flexShrink:1},options:{gap:7,marginTop:2},option:{borderTopWidth:1,paddingTop:7,gap:4,minWidth:0},note:{fontSize:11,lineHeight:15,flexShrink:1},button:{borderWidth:1,borderRadius:20,minHeight:44,minWidth:48,paddingHorizontal:13,paddingVertical:9,justifyContent:'center',alignSelf:'flex-start',flexShrink:1,maxWidth:'100%'},inlineButton:{alignSelf:'flex-start',minHeight:44,justifyContent:'center',paddingHorizontal:3}});
