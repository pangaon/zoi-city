import {useState} from 'react';
import {Pressable,StyleSheet,useColorScheme,View} from 'react-native';
import {ScaleText as Text} from './ScaleText';
import type {NativeServiceOfferings,ServiceDetail} from './serviceOfferings';

/** Read-only published details. Booking/availability remain separate capabilities. */
export function ServiceOfferings({offerings}:{offerings:NativeServiceOfferings}){
 const[limit,setLimit]=useState(12),dark=useColorScheme()==='dark';
 const ink=dark?'#F1F6FA':'#163449',secondary=dark?'#B9CCD9':'#4F6472',border=dark?'#446071':'#C8D8E2',surface=dark?'#102A3B':'#F7FAFC',card=dark?'#19394D':'#FFFFFF';
 const detail=(item:ServiceDetail)=><><View style={s.detailHeading}><Text selectable accessibilityRole="header" style={[s.name,{color:ink}]}>{item.name}</Text>{item.price?<Text selectable style={[s.price,{color:ink}]}>Price: {item.price}</Text>:null}</View>{item.duration?<Text selectable style={[s.body,{color:secondary}]}>Duration: {item.duration}</Text>:null}{item.description?<Text selectable style={[s.body,{color:secondary}]}>{item.description}</Text>:null}</>;
 if(!offerings.items.length&&!offerings.bounded)return null;
 return <View testID="service-offerings" style={[s.panel,{backgroundColor:surface,borderColor:border}]}><Text accessibilityRole="header" style={[s.title,{color:ink}]}>Services & options</Text>
 {offerings.items.slice(0,limit).map((item,index)=><View key={index} style={[s.card,{borderColor:border,backgroundColor:card}]}>{detail(item)}{item.options.length?<View style={s.options}><Text accessibilityRole="header" style={[s.body,{color:ink,fontWeight:'600'}]}>Options</Text>{item.options.map((option,i)=><View key={i} style={[s.option,{borderColor:border}]}>{detail(option)}</View>)}</View>:null}{item.optionsBounded?<Text style={[s.note,{color:secondary}]}>More options may be available on their website.</Text>:null}</View>)}
 {offerings.items.length?<Text accessibilityLiveRegion="polite" style={[s.note,{color:secondary}]}>{Math.min(limit,offerings.items.length)} of {offerings.total} services</Text>:null}
 {limit<offerings.items.length?<Pressable accessibilityRole="button" onPress={()=>setLimit(n=>n+12)} style={[s.button,{borderColor:border,backgroundColor:card}]}><Text style={[s.body,{color:ink,fontWeight:'600'}]}>Show {Math.min(12,offerings.items.length-limit)} more services</Text></Pressable>:null}
 {offerings.bounded?<Text style={[s.note,{color:secondary}]}>More services may be available on their website.</Text>:null}
 {offerings.origin==='source'?<Text style={[s.note,{color:secondary}]}>These details have not been confirmed by the owner.</Text>:null}
 <Text style={[s.note,{color:secondary}]}>Confirm current prices, options and availability with the business.</Text></View>;
}
const s=StyleSheet.create({panel:{gap:12,minWidth:0,padding:16,borderRadius:18,borderWidth:1},title:{fontSize:24,lineHeight:32,fontWeight:'700'},detailHeading:{flexDirection:'row',flexWrap:'wrap',alignItems:'flex-start',gap:10},price:{fontSize:17,lineHeight:27,fontWeight:'600',maxWidth:'100%',flexShrink:1},card:{borderWidth:1,borderRadius:14,padding:16,gap:8,minWidth:0},name:{fontSize:19,lineHeight:28,fontWeight:'700',flexShrink:1,flexGrow:1,flexBasis:170},body:{fontSize:16,lineHeight:25,flexShrink:1},options:{gap:10,marginTop:4},option:{borderTopWidth:1,paddingTop:10,gap:6,minWidth:0},note:{fontSize:14,lineHeight:22,flexShrink:1},button:{borderWidth:1,borderRadius:10,minHeight:48,minWidth:48,padding:12,justifyContent:'center',alignSelf:'flex-start',flexShrink:1,maxWidth:'100%'}});
