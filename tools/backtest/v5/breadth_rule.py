exec(open('/home/claude/v5/breadth_test.py').read().split("def sh(")[0].replace("exec(open('daytype.py')","exec(open('/home/claude/v5/daytype.py')"))
def res(keep, half=False):
    tot=0;b=0;c=0;n=0;L=[]
    for x in out:
        d,D,B,agree,R=x
        k=keep(D,B)
        r=R if k else (R*0.5 if half else 0)
        if k or half: n+=1
        tot+=r; L.append(r)
        if d<'2026-10-19': b+=r
        else: c+=r
    return n,tot,b,c,sum(1 for r in L if r<0)
def against(D,B,lo,hi): return (D=='BUY' and B<lo) or (D=='SELL' and B>hi)
print('9 days, Proposal B picks, trail-1R exit (1-min sim)')
for lab,f,h in [('ALL trades (now)',lambda D,B:True,False),
                ('SKIP against breadth (50% line)',lambda D,B:not against(D,B,50,50),False),
                ('SKIP against, mixed zone 45-55 traded',lambda D,B:not against(D,B,45,55),False),
                ('SKIP against, mixed zone 40-60 traded',lambda D,B:not against(D,B,40,60),False),
                ('HALF size against (50% line)',lambda D,B:not against(D,B,50,50),True),
                ('HALF size against, zone 45-55',lambda D,B:not against(D,B,45,55),True)]:
    n,t,b,c,neg=res(f,h); print(f"{lab:<40} trades {n:>2} net {t:+6.1f}R | build days {b:+5.1f} check days {c:+5.1f} | losing trades {neg}")
