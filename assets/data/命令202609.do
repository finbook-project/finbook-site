*======================================================================= 
*                 单变量排序法——以BM为例
*=======================================================================
* 切换到数据所在路径
cd "/Users/linsihui/Desktop/书/数据与命令/"

use "财务数据.dta", clear
list in 1/10
* Step1
**因子排序 (分位处理)
egen BMgroup=xtile(BM), n(10) by(Year)
list in 1/10
*Step2
** 对组合进行加权处理
***（1） 计算流通市值加权组合收益率
gen GYear=Year+1
save 单变量分组结果.dta, replace

use "收益率数据.dta", clear
gen GYear=year(dofm(Mon-4))
merge m:1 Stkcd GYear using 单变量分组结果.dta, nogen keep(3) 

bys BMgroup Mon: egen MEratio=pc(ME), prop
gen PortReturn=RRf*MEratio
collapse (sum) PortReturn, by(BMgroup Mon)
*** (2)转化格式
spread BMgroup  PortReturn 
list in 1/10
*Step3 构建价差组合
gen gap=PortReturn10-PortReturn1
list PortReturn10 PortReturn1 gap in 1/10
*Step4 t-检验（根据Newey和West（1987）5期滞后调整得到的T统计量值）
tsset Mon 
newey gap, lag(5)


*======================================================================= 
*                 双变量独立排序法——以FF（1993）价值因子与规模因子
*=======================================================================
* 切换到数据所在路径

use "财务数据.dta", clear
list in 1/10
* Step1
**因子排序 (分位处理)
* Liu et al. (2018) 研究指出，中国股市中市值最小的 30% 的上市公司会受到壳价值污染的严重影响，造成 asset pricing 模型不能正确反映出股票截面预期收益率的差异。为了更好的研究 A 股的定价机制，必须抛弃这市值最小的 30% 的公司。
// egen ME_10=xtile(ME), n(10) by(Year)
// drop if ME_10<=3

* 规模的分组点为中位数
* 前50%为小规模组S
* 后50%为大规模组B
egen 规模分组=xtile(ME), n(2) by(Year)
gen MEgroup="S" if 规模分组==1
replace MEgroup="B" if 规模分组==2

* 账面市值比分组点为第30个和第70个百分位数

egen 账面市值比分组=xtile(BM), n(10) by(Year )
// egen 账面市值比分组=xtile(BM), n(10) by(Year MEgroup)
gen BMgroup="L" if 账面市值比分组<=3
replace BMgroup="M" if 账面市值比分组>3 & 账面市值比分组<=7
replace BMgroup="H" if 账面市值比分组>7
list in 1/10

* Step2
** 对组合进行加权处理
gen GYear=Year+1
save 双变量分组结果.dta, replace
use "收益率数据.dta", clear
gen GYear=year(dofm(Mon-4))
merge m:1 Stkcd GYear using 双变量分组结果.dta, nogen keep(3) 

bys BMgroup MEgroup Mon: egen MEratio=pc(ME), prop
gen PortReturn=RRf*MEratio
collapse (sum) PortReturn , by(BMgroup MEgroup Mon)
save data1.dta, replace 
list in 1/10

*Step3 构建价差组合
** 计算SMB：SMB=(SH+SM+SL)/3 -(BH+BM+BL)/3
use  data1.dta, clear
spread MEgroup PortReturn
egen gro=group(BMgroup)
xtset gro Mon
gen SMB_part=S-B
collapse (mean) SMB_part, by(Mon)
rename SMB_part SMB
save SMB.dta, replace
list in 1/10

** 计算HML：HML=(SH+BH)/2- (SL+BL)/2
use  data1.dta, clear
spread BMgroup PortReturn 
egen gro=group(MEgroup)
xtset gro Mon
gen HML_part=H-L
collapse (mean) HML_part, by(Mon)
rename HML_part HML
save HML.dta, replace
list in 1/10

*Step4 t-检验(以HML因子为例，SMB操作步骤相同)（根据Newey和West（1987）5期滞后调整得到的T统计量值）
use HML.dta,clear
tsset Mon
newey HML, lag(5)





*======================================================================= 
*                Fama—macbeth横截面回归检验
*=======================================3===============================
*考虑因变量(Dependent variable)为超额收益率 、自变量为市场因子、规模因子和价值因子的Fama-Macbeth 回归问题
use "FM回归检验.dta",clear
*定义面板数据（横截面变量和时间变量）：
xtset Stkcd Mon
///第一阶段：时序回归，窗口为 60 个月，每次向后移动一个月
bys Stkcd: asreg RRf MKT SMB HML, wind(Mon 60) 
 // 保留样本数为60的
keep if _Nobs==60 
list in 1/10
drop  _b_cons _adjR2 _R2 _Nobs 
///第二阶段：横截面回归
///asreg模块实例
global beta _b_MKT _b_SMB _b_HML
foreach i in $beta{
	gen L`i'=L.`i'
	}
asreg RRf L*, fmb newey(4) 

///xtfmb模块实例
xtfmb RRf L*, lag(4) 



*===============================================================================
*                             alpha检验：利用其他四个因子回归解释第五个因子
*===============================================================================
use "五因子数据.dta", clear

reg RMW MKT SMB HML,robust
est store r2_1
reg CMA MKT SMB HML,robust
est store r2_2
esttab r2_1 r2_2, nogap replace star(* 0.1 ** 0.05 *** 0.01) b(3) t(2) ar2 order( _cons MKT SMB HML)

*===============================================================================
*                             GRS检验 Size-BM
*===============================================================================
use "五因子数据.dta", clear
* GRS检验 flist后面放入因子
grstest2 RMW CMA, flist( MKT SMB HML)  alphas 

*======================================================================= 
*                  事件研究法
*=======================================================================
///estudy命令示例
use "data_estudy.dta", clear
*利用市场模型估计正常收益率，并以（-1，+1）为事件窗口期，同时计算多家公司事件窗口期的累积异常收益率与平均累积异常收益率，可运行以下语句：
estudy apple netflix amazon facebook google,  datevar(date) evdate(07092015) dateformat(MDY) lb1(-3) ub1(3)  indexlist(mkt) 
*利用Fama三因子模型估计正常收益率，并以（-1，+1）、（-3，+3）为事件窗口期，同时计算多家公司四个时间窗口期的累积异常收益率与平均累积异常收益率，并使用 Kolari 和 Pynnonen (2010) 的方法检验显著性，可运行以下语句：
estudy apple netflix amazon facebook google(boa ford boeing), datevar(date) evdate(07092015) dateformat(MDY) lb1(-1) ub1(1) lb2(-3) ub2(3) modtype(MFM) indexlist(mkt smb hml) diagnosticsstat(KP) 


///eventstudy2命令示例
use "Earnings_surprises.dta", clear 
*使用市场调整模型估计股票异常收益率和并使用默认参数的进行基本示例事件研究
eventstudy2 Security_id Date using Security_returns , returns(Return)

*使用Fama三因子模型估计股票异常收益率进行示例事件研究
eventstudy2 Security_id Date using Security_returns if Ea>0.05,  ///
   ret(Return) car1LB(-1) car1UB(1) mod(FM) ///
   marketfile(Factor_returns) mar(MKT)      ///
   idmar(Market_reference)   ///
   factor1(SMB) factor2(HML) ///
   risk(risk_free_rate)
